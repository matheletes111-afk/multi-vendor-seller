import { NextRequest, NextResponse } from "next/server"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authStatus = await getMobileCustomerAuth(request)
  if (!authStatus.ok || !authStatus.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const booking = await prisma.hotelBooking.findFirst({
    where: {
      id,
      userId: authStatus.userId,
    },
  })

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  if (booking.paymentStatus !== "PENDING" || booking.status !== "PENDING") {
    return NextResponse.json({
      success: false,
      message: "Booking is already confirmed or completed.",
      status: booking.status,
      paymentStatus: booking.paymentStatus,
    })
  }

  // Cancel booking & release room availability
  await prisma.hotelBooking.update({
    where: { id: booking.id },
    data: {
      status: "CANCELLED",
      paymentStatus: "FAILED",
      settlementStatus: "CANCELLED",
    },
  })

  await prisma.roomAvailability.updateMany({
    where: {
      roomId: booking.roomId,
      date: { gte: booking.checkIn, lt: booking.checkOut },
    },
    data: { bookedCount: { decrement: booking.numberOfRooms } },
  }).catch(() => null)

  // Release coupon if used
  await prisma.couponUsage.deleteMany({
    where: { hotelBookingId: booking.id },
  }).catch(() => null)

  return NextResponse.json({
    success: true,
    message: "Pending booking cancelled and room released.",
  })
}
