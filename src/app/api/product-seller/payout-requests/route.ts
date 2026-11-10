import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isProductSeller } from "@/lib/rbac"
import { getMobileSellerAuth } from "@/app/mobileapi/_helpers/seller-auth"
import { UserRole } from "@prisma/client"
import { getSellerPayoutStatus, requestSellerPayout } from "@/lib/seller-payout-service"

async function resolveUserId(request: NextRequest): Promise<string | null> {
  const session = await auth()
  if (session?.user && isProductSeller(session.user)) return session.user.id
  const mobileAuth = await getMobileSellerAuth(request, UserRole.SELLER_PRODUCT)
  if (mobileAuth.ok && mobileAuth.userId) return mobileAuth.userId
  return null
}

export async function GET(request: NextRequest) {
  const userId = await resolveUserId(request)
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const data = await getSellerPayoutStatus({ sellerSector: "PRODUCT", userId })
    return NextResponse.json({ success: true, ...data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  const userId = await resolveUserId(request)
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const body = await request.json().catch(() => ({}))
    const payoutRequest = await requestSellerPayout({
      sellerSector: "PRODUCT",
      userId,
      sellerNote: body.sellerNote,
    })
    return NextResponse.json({ success: true, payoutRequest })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: 400 })
  }
}

