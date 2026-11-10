import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getMobileRiderAuth } from "@/app/mobileapi/_helpers/rider-auth"
import { getSellerPayoutStatus, requestSellerPayout } from "@/lib/seller-payout-service"

async function resolveRiderUserId(request: NextRequest): Promise<string | null> {
  const session = await auth()
  if (session?.user?.id && session.user.role === "RIDER") {
    return session.user.id
  }
  const mobileAuth = await getMobileRiderAuth(request)
  if (mobileAuth.ok && mobileAuth.userId) {
    return mobileAuth.userId
  }
  return null
}

export async function GET(request: NextRequest) {
  const userId = await resolveRiderUserId(request)
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const data = await getSellerPayoutStatus({ sellerSector: "RIDER", userId })
    return NextResponse.json({ success: true, ...data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load payout status" }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  const userId = await resolveRiderUserId(request)
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const body = await request.json().catch(() => ({}))
    const payoutRequest = await requestSellerPayout({
      sellerSector: "RIDER",
      userId,
      sellerNote: body.sellerNote,
    })
    return NextResponse.json({ success: true, payoutRequest })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to request payout" }, { status: 400 })
  }
}

