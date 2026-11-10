import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getMobileHotelRestaurantSellerAuth } from "@/app/mobileapi/_helpers/hotel-restaurant-seller-auth"
import { UserRole } from "@prisma/client"
import { getSellerPayoutStatus, requestSellerPayout } from "@/lib/seller-payout-service"

async function resolveUserId(request: NextRequest): Promise<string | null> {
  const session = await auth()
  if (session?.user && session.user.role === "SELLER_RESTAURANT") return session.user.id
  const mobileAuth = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_RESTAURANT)
  if (mobileAuth.ok && mobileAuth.userId) return mobileAuth.userId
  return null
}

export async function GET(request: NextRequest) {
  const userId = await resolveUserId(request)
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const data = await getSellerPayoutStatus({ sellerSector: "RESTAURANT", userId })
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
      sellerSector: "RESTAURANT",
      userId,
      sellerNote: body.sellerNote,
    })
    return NextResponse.json({ success: true, payoutRequest })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: 400 })
  }
}

