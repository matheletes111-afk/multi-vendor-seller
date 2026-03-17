import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"

const MAX_RECENT_VIEWS = 10

type RecentViewRow = {
  product: {
    id: string
    isActive: boolean
    name: string
    slug: string
    images: unknown
    category: { id: string; name: string; slug: string }
    seller: { store: { name: string } | null } | null
    variants: { price: number; discount: number }[]
  } | null
}

// Prisma client exposes RecentView as recentView (camelCase). Cast for TS until prisma generate is run.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const recentViewDb = (prisma as any).recentView as
  | {
      findMany: (args: unknown) => Promise<RecentViewRow[]>
      upsert: (args: unknown) => Promise<unknown>
      deleteMany: (args: unknown) => Promise<unknown>
    }
  | undefined

/** GET recent viewed products for the logged-in customer. Returns at most 10, newest first. */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== UserRole.CUSTOMER) {
      return NextResponse.json({ products: [] })
    }

    if (!recentViewDb) {
      return NextResponse.json({ products: [] })
    }

    const views = await recentViewDb.findMany({
      where: { userId: session.user.id },
      orderBy: { viewedAt: "desc" },
      take: MAX_RECENT_VIEWS,
      include: {
        product: {
          select: {
            id: true,
            isActive: true,
            name: true,
            slug: true,
            images: true,
            category: { select: { id: true, name: true, slug: true } },
            seller: { select: { store: { select: { name: true } } } },
            variants: {
              take: 1,
              orderBy: { createdAt: "asc" },
              select: { price: true, discount: true },
            },
          },
        },
      },
    }) as RecentViewRow[]

    const products = views
      .map((v) => v.product)
      .filter((p): p is NonNullable<RecentViewRow["product"]> => p != null && p.isActive)
      .map((p) => {
        const first = p.variants[0]
        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          images: (p.images as string[]) ?? [],
          category: p.category,
          seller: p.seller,
          basePrice: first?.price ?? 0,
          discount: first?.discount ?? 0,
        }
      })

    return NextResponse.json({ products })
  } catch (error) {
    console.error("Recent views GET error:", error)
    return NextResponse.json(
      { error: "Failed to fetch recent views" },
      { status: 500 }
    )
  }
}

/** POST record a product view. Body: { productId: string }. Keeps max 10 per customer (oldest removed). */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== UserRole.CUSTOMER) {
      return NextResponse.json({ ok: true })
    }

    let body: { productId?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      )
    }

    const productId = typeof body?.productId === "string" ? body.productId.trim() : ""
    if (!productId) {
      return NextResponse.json(
        { error: "productId is required" },
        { status: 400 }
      )
    }

    const product = await prisma.product.findUnique({
      where: { id: productId, isActive: true },
      select: { id: true },
    })
    if (!product) {
      return NextResponse.json({ ok: true })
    }

    const userId = session.user.id

    if (!recentViewDb) {
      return NextResponse.json({ ok: true })
    }

    await recentViewDb.upsert({
      where: {
        userId_productId: { userId, productId },
      },
      create: { userId, productId },
      update: { viewedAt: new Date() },
    })

    const over = await recentViewDb.findMany({
      where: { userId },
      orderBy: { viewedAt: "desc" },
      select: { id: true },
    })

    if (over.length > MAX_RECENT_VIEWS) {
      const toRemove = (over as unknown as { id: string }[])
        .slice(MAX_RECENT_VIEWS)
        .map((r) => r.id)
      await recentViewDb.deleteMany({
        where: { id: { in: toRemove } },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Recent views POST error:", error)
    return NextResponse.json(
      { error: "Failed to record recent view" },
      { status: 500 }
    )
  }
}
