import { NextRequest, NextResponse } from "next/server"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getMobileCustomerAuth(request)
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { id: bookingId } = await params
    const booking = await prisma.hotelBooking.findFirst({
      where: {
        id: bookingId,
        userId: auth.userId,
      },
      include: {
        room: true,
        hotel: true
      }
    })

    if (!booking) {
      return NextResponse.json({ success: false, error: "Booking not found" }, { status: 404 })
    }

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
      flotOrderId: booking.flotOrderId,
      flotPaymentLink: booking.flotPaymentLink,
      paidAt: booking.paidAt,
      createdAt: booking.createdAt,
      room: booking.room,
      hotel: booking.hotel,
    }

    return NextResponse.json({ success: true, data: sanitizedBooking })
  } catch (error) {
    console.error("Error fetching mobile booking details:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
