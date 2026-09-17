import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { formatTimeAgo } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const revalidate = 0

const MAX_RECENT_VIEWS = 10

type RecentViewRow = {
  id: string
  userId: string
  productId: string
  viewedAt: Date
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

/** GET recent viewed products for the logged-in customer (or guestIds param for guests). Returns at most 10, newest first. */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    const guestIdsParam = searchParams.get("guestIds")

    // 1. Authenticated customer flow
    if (session?.user?.id && session.user.role === UserRole.CUSTOMER) {
      if (!recentViewDb) {
        return NextResponse.json({ products: [] })
      }

      const views = (await recentViewDb.findMany({
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
      })) as RecentViewRow[]

      const products = views
        .filter((v) => v.product != null && v.product.isActive)
        .map((v) => {
          const p = v.product!
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
            viewedAt: v.viewedAt ? v.viewedAt.toISOString() : new Date().toISOString(),
            timeAgo: formatTimeAgo(v.viewedAt),
          }
        })

      return NextResponse.json(
        { products },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
        }
      )
    }

    // 2. Guest user flow (via ?guestIds=id1,id2,...)
    if (guestIdsParam) {
      const ids = guestIdsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, MAX_RECENT_VIEWS)

      if (ids.length > 0) {
        const guestProducts = await prisma.product.findMany({
          where: {
            id: { in: ids },
            isActive: true,
            isDeleted: false,
          },
          select: {
            id: true,
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
        })

        const idIndexMap = new Map(ids.map((id, idx) => [id, idx]))
        const products = guestProducts
          .sort((a, b) => (idIndexMap.get(a.id) ?? 0) - (idIndexMap.get(b.id) ?? 0))
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
              viewedAt: new Date().toISOString(),
              timeAgo: "Just now",
            }
          })

        return NextResponse.json(
          { products },
          {
            headers: {
              "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            },
          }
        )
      }
    }

    return NextResponse.json(
      { products: [] },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    )
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
