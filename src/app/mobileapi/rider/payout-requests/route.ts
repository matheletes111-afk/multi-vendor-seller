import { NextRequest, NextResponse } from "next/server"
import { getMobileRiderAuth } from "../../_helpers/rider-auth"
import { getSellerPayoutStatus, requestSellerPayout } from "@/lib/seller-payout-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const authStatus = await getMobileRiderAuth(request)
  if (!authStatus.ok || !authStatus.userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }
  try {
    const data = await getSellerPayoutStatus({ sellerSector: "RIDER", userId: authStatus.userId })
    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to load payout status" }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  const authStatus = await getMobileRiderAuth(request)
  if (!authStatus.ok || !authStatus.userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }
  try {
    const body = await request.json().catch(() => ({}))
    const payoutRequest = await requestSellerPayout({
      sellerSector: "RIDER",
      userId: authStatus.userId,
      sellerNote: body.sellerNote,
    })
    return NextResponse.json({ success: true, payoutRequest })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to request payout" }, { status: 400 })
  }
}

