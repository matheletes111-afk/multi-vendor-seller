import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isRestaurantSeller } from "@/lib/rbac"
import { getMobileHotelRestaurantSellerAuth } from "@/app/mobileapi/_helpers/hotel-restaurant-seller-auth"
import { UserRole } from "@prisma/client"

export async function GET(request: NextRequest) {
  let isAuthorized = false

  const session = await auth()
  if (session?.user && isRestaurantSeller(session.user)) {
    isAuthorized = true
  } else {
    const mobileAuth = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_RESTAURANT)
    if (mobileAuth.ok) {
      isAuthorized = true
    }
  }

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json({
    success: true,
    hasActiveJob: false,
    message: "No long-running background job active. Food imports complete synchronously.",
  })
}
