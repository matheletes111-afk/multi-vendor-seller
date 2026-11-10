import { NextRequest, NextResponse } from "next/server"
import { getMobileSellerAuth } from "@/app/mobileapi/_helpers/seller-auth"
import { UserRole } from "@prisma/client"
import { getSellerPayoutStatus, requestSellerPayout } from "@/lib/seller-payout-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const authStatus = await getMobileSellerAuth(request, UserRole.SELLER_PRODUCT)
  if (!authStatus.ok || !authStatus.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const data = await getSellerPayoutStatus({ sellerSector: "PRODUCT", userId: authStatus.userId })
    return NextResponse.json({ success: true, ...data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  const authStatus = await getMobileSellerAuth(request, UserRole.SELLER_PRODUCT)
  if (!authStatus.ok || !authStatus.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const body = await request.json().catch(() => ({}))
    const payoutRequest = await requestSellerPayout({
      sellerSector: "PRODUCT",
      userId: authStatus.userId,
      sellerNote: body.sellerNote,
    })
    return NextResponse.json({ success: true, payoutRequest })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: 400 })
  }
}
