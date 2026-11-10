import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

async function resolveCustomerUserId(request: NextRequest): Promise<string | null> {
  const session = await auth()
  if (session?.user?.id) return session.user.id

  const mobileAuth = await getMobileCustomerAuth(request)
  if (mobileAuth.ok) return mobileAuth.userId

  return null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const customerId = await resolveCustomerUserId(request)
  if (!customerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const booking = await prisma.hotelBooking.findFirst({
    where: {
      id,
      userId: customerId,
    },
  })

  if (!booking) {
    return NextResponse.json({ error: "Hotel booking not found" }, { status: 404 })
  }

  if (booking.paymentStatus !== "PENDING" || booking.status !== "PENDING") {
    return NextResponse.json({
      success: false,
      message: "Hotel booking is already completed or processed.",
      status: booking.status,
      paymentStatus: booking.paymentStatus,
    })
  }

  // Cancel booking & payment
  await prisma.hotelBooking.update({
    where: { id: booking.id },
    data: {
      status: "CANCELLED",
      paymentStatus: "FAILED",
      settlementStatus: "CANCELLED",
    },
  })

  // Rollback room availability
  try {
    const start = new Date(booking.checkIn)
    const end = new Date(booking.checkOut)
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      await prisma.roomAvailability.updateMany({
        where: {
          roomId: booking.roomId,
          date: new Date(d.toISOString().split("T")[0]),
        },
        data: {
          bookedCount: { decrement: booking.numberOfRooms },
        },
      })
    }
  } catch (availErr) {
    console.warn("[Cancel Pending Booking] Could not release room availability:", availErr)
  }

  // Restore coupon
  await prisma.couponUsage.deleteMany({
    where: { hotelBookingId: booking.id },
  }).catch(() => null)

  return NextResponse.json({
    success: true,
    message: "Pending hotel booking cancelled and room availability released.",
  })
}

