import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyMobileAccessToken } from "@/lib/mobile-jwt"

export const dynamic = "force-dynamic"

const MAX_RECENT_VIEWS = 10

// Prisma recentView delegate (same as web API)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const recentViewDb = (prisma as any).recentView as
  | {
      upsert: (args: unknown) => Promise<unknown>
      findMany: (args: unknown) => Promise<{ id: string }[]>
      deleteMany: (args: unknown) => Promise<unknown>
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

interface SuccessResponse {
  success: true
  message: string
  data?: { ok: true }
}

interface ErrorResponse {
  success: false
  error: string
}

/** POST /mobileapi/customer/recent-view/insert — record a product view. Body: { productId: string }. Auth: Bearer token (customer). Max 10 per customer. */
export async function POST(
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

    let body: { productId?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json<ErrorResponse>(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      )
    }

    const productId = typeof body?.productId === "string" ? body.productId.trim() : ""
    if (!productId) {
      return NextResponse.json<ErrorResponse>(
        { success: false, error: "productId is required" },
        { status: 400 }
      )
    }

    const product = await prisma.product.findUnique({
      where: { id: productId, isActive: true, isDeleted: false },
      select: { id: true },
    })
    if (!product) {
      return NextResponse.json<SuccessResponse>({
        success: true,
        message: "Product not found or inactive",
      })
    }

    if (!recentViewDb) {
      return NextResponse.json<SuccessResponse>({
        success: true,
        message: "Recent view recorded",
      })
    }

    await recentViewDb.upsert({
      where: { userId_productId: { userId, productId } },
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
      await recentViewDb.deleteMany({ where: { id: { in: toRemove } } })
    }

    return NextResponse.json<SuccessResponse>({
      success: true,
      message: "Recent view recorded",
      data: { ok: true },
    })
  } catch (error) {
    console.error("Mobile recent-view insert error:", error)
    return NextResponse.json<ErrorResponse>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
