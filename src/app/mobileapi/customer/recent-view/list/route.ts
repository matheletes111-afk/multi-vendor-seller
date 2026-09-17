import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyMobileAccessToken } from "@/lib/mobile-jwt"
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
  viewedAt?: string
  viewed_at?: string
  timeAgo?: string
  time_ago?: string
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

    const views = (await recentViewDb.findMany({
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
    })) as RecentViewRow[]

    const products: ProductItem[] = views
      .filter((v) => v.product != null && v.product.isActive)
      .map((v) => {
        const p = v.product!
        const first = p.variants[0]
        const timeAgo = formatTimeAgo(v.viewedAt)
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
          viewed_at: v.viewedAt ? v.viewedAt.toISOString() : new Date().toISOString(),
          timeAgo: timeAgo,
          time_ago: timeAgo,
        }
      })

    return NextResponse.json<SuccessResponse>(
      {
        success: true,
        message: "Recent views fetched successfully",
        data: { products, total: products.length },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    )
  } catch (error) {
    console.error("Mobile recent-view list error:", error)
    return NextResponse.json<ErrorResponse>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
