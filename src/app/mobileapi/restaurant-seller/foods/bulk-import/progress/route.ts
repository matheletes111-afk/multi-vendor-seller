import { NextRequest, NextResponse } from "next/server"
import { getMobileHotelRestaurantSellerAuth } from "@/app/mobileapi/_helpers/hotel-restaurant-seller-auth"
import { UserRole } from "@prisma/client"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const authStatus = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_RESTAURANT)
  if (!authStatus.ok) {
    return NextResponse.json(
      { success: false, error: authStatus.error === "unauthorized" ? "Unauthorized" : "Forbidden" },
      { status: authStatus.error === "unauthorized" ? 401 : 403 }
    )
  }

  return NextResponse.json({
    success: true,
    hasActiveJob: false,
    message: "No long-running background job active. Food imports complete synchronously.",
  })
}
