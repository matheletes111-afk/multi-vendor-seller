import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyMobileAccessToken } from "@/lib/mobile-jwt"

export const dynamic = "force-dynamic"

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const recentViewDb = (prisma as any).recentView as
  | {
      findMany: (args: unknown) => Promise<RecentViewRow[]>
    }
  | undefined

function getCustomerId(request: NextRequest): string | null {
  const auth = request.headers.get("Authorization")
  if (!auth?.startsWith("Bearer ")) return null
  const token = auth.slice(7).trim()
  const payload = verifyMobileAccessToken(token)
  if (!payload || payload.role !== "CUSTOMER") return null
  return payload.userId
}

interface ProductItem {
  id: string
  name: string
  slug: string
  images: string[]
  category: { id: string; name: string; slug: string }
  seller: { store: { name: string } | null } | null
  basePrice: number
  discount: number
}

interface SuccessResponse {
  success: true
  message: string
  data: { products: ProductItem[]; total: number }
}

interface ErrorResponse {
  success: false
  error: string
}

/** GET /mobileapi/customer/recent-view/list — list recent viewed products (max 10). Auth: Bearer token (customer). */
export async function GET(
  request: NextRequest
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    const userId = getCustomerId(request)
    if (!userId) {
      return NextResponse.json<ErrorResponse>(
        { success: false, error: "Unauthorized. Valid customer token required." },
        { status: 401 }
      )
    }

    if (!recentViewDb) {
      return NextResponse.json<SuccessResponse>({
        success: true,
        message: "Recent views fetched successfully",
        data: { products: [], total: 0 },
      })
    }

    const views = await recentViewDb.findMany({
      where: { userId },
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

    const products: ProductItem[] = views
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

    return NextResponse.json<SuccessResponse>({
      success: true,
      message: "Recent views fetched successfully",
      data: { products, total: products.length },
    })
  } catch (error) {
    console.error("Mobile recent-view list error:", error)
    return NextResponse.json<ErrorResponse>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
