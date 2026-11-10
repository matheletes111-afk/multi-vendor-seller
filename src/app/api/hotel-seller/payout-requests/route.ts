import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isHotelSeller } from "@/lib/rbac"
import { getMobileHotelRestaurantSellerAuth } from "@/app/mobileapi/_helpers/hotel-restaurant-seller-auth"
import { UserRole } from "@prisma/client"
import { getSellerPayoutStatus, requestSellerPayout } from "@/lib/seller-payout-service"

async function resolveUserId(request: NextRequest): Promise<string | null> {
  const session = await auth()
  if (session?.user && isHotelSeller(session.user)) return session.user.id
  const mobileAuth = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_HOTEL)
  if (mobileAuth.ok && mobileAuth.userId) return mobileAuth.userId
  return null
}

export async function GET(request: NextRequest) {
  const userId = await resolveUserId(request)
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const data = await getSellerPayoutStatus({ sellerSector: "HOTEL", userId })
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
      sellerSector: "HOTEL",
      userId,
      sellerNote: body.sellerNote,
    })
    return NextResponse.json({ success: true, payoutRequest })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: 400 })
  }
}

