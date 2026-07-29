import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"

export async function GET(request: NextRequest) {
  try {
    const authResult = await getMobileCustomerAuth(request)
    if (!authResult.ok || !authResult.userId) {
      return NextResponse.json({
        success: true,
        data: {
          unread_count: 0,
          has_critical: false,
        },
      })
    }

    const userId = authResult.userId

    // Dynamically calculate active updates for customer orders & bookings from Prisma
    const [activeProductOrders, activeFoodOrders, activeHotelBookings] = await Promise.all([
      prisma.order.count({
        where: {
          customerId: userId,
          status: { in: ["CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY"] },
        },
      }),
      prisma.foodOrder.count({
        where: {
          customerId: userId,
          status: { in: ["CONFIRMED", "PROCESSING", "OUT_FOR_DELIVERY"] },
        },
      }),
      prisma.hotelBooking.count({
        where: {
          userId,
          status: { in: ["PENDING", "CONFIRMED"] },
        },
      }),
    ])

    const totalUnreadCount = activeProductOrders + activeFoodOrders + activeHotelBookings

    return NextResponse.json({
      success: true,
      data: {
        unread_count: totalUnreadCount,
        has_critical: false,
      },
    })
  } catch (error) {
    console.error("Notifications unread count API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
