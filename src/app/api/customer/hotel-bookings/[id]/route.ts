import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    let customerId: string | null = null
    const session = await auth()
    if (session?.user?.id && session.user.role === "CUSTOMER") {
      customerId = session.user.id
    } else {
      const mobileAuth = await getMobileCustomerAuth(request)
      if (mobileAuth.ok) {
        customerId = mobileAuth.userId
      }
    }

    if (!customerId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { id: bookingId } = await params
    const booking = await prisma.hotelBooking.findFirst({
      where: {
        id: bookingId,
        userId: customerId,
      },
      include: {
        room: true,
        hotel: true
      }
    })

    if (!booking) {
      return NextResponse.json({ success: false, error: "Booking not found" }, { status: 404 })
    }

    // Customer payload: all payment & price breakup data included; commission strictly hidden
    const sanitizedBooking = {
      id: booking.id,
      userId: booking.userId,
      roomId: booking.roomId,
      hotelId: booking.hotelId,
      guestName: booking.guestName,
      guestPhone: booking.guestPhone,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      numberOfRooms: booking.numberOfRooms,
      adults: booking.adults,
      children: booking.children,
      subtotal: booking.subtotal,
      couponCode: booking.couponCode,
      couponDiscount: booking.couponDiscount,
      totalPrice: booking.totalPrice,
      status: booking.status,
      paymentMethod: booking.paymentMethod ?? "COD",
      paymentStatus: booking.paymentStatus,
      afriTxnId: booking.afriTxnId,
      paidAt: booking.paidAt,
      createdAt: booking.createdAt,
      room: booking.room,
      hotel: booking.hotel,
    }

    return NextResponse.json({ success: true, data: sanitizedBooking })
  } catch (error) {
    console.error("Error fetching customer hotel booking details:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

