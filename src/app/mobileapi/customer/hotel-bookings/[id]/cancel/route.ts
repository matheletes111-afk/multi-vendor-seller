import { NextRequest, NextResponse } from "next/server"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { prisma } from "@/lib/prisma"
import { debitHotelSellerForCancellation } from "@/lib/hotel-ledger"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getMobileCustomerAuth(request)
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const userId = auth.userId
    const { id: bookingId } = await params

    const booking = await prisma.hotelBooking.findFirst({
      where: {
        id: bookingId,
        userId,
      },
      include: {
        room: true,
      }
    })

    if (!booking) {
      return NextResponse.json({ success: false, error: "Booking not found" }, { status: 404 })
    }

    if (booking.status === "CANCELLED") {
      return NextResponse.json({ success: false, error: "Booking is already cancelled" }, { status: 400 })
    }

    const now = new Date()
    const checkInTime = new Date(booking.checkIn)

    // Calculate time difference in hours
    const diffInMs = checkInTime.getTime() - now.getTime()
    const diffInHours = diffInMs / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return NextResponse.json({ success: false, error: "Bookings can only be cancelled at least 24 hours before check-in date" }, { status: 400 })
    }

    // Release inventory dates
    const stayDates: Date[] = []
    let currentDate = new Date(booking.checkIn.getTime())
    const checkOutDate = new Date(booking.checkOut.getTime())

    while (currentDate < checkOutDate) {
      stayDates.push(new Date(currentDate.getTime()))
      currentDate.setDate(currentDate.getDate() + 1)
    }

    const roomsToRelease = booking.numberOfRooms

    await prisma.$transaction(async (tx) => {
      // 1. Update Booking status to CANCELLED
      await tx.hotelBooking.update({
        where: { id: bookingId },
        data: { status: "CANCELLED" }
      })

      // Debit the hotel seller balance & create ledger transaction
      await debitHotelSellerForCancellation(tx, bookingId)

      // 2. Decrement bookedCount in room availability for each stay date
      for (const date of stayDates) {
        const avail = await tx.roomAvailability.findUnique({
          where: {
            roomId_date: {
              roomId: booking.roomId,
              date
            }
          }
        })
        if (avail) {
          const newBookedCount = Math.max(0, avail.bookedCount - roomsToRelease)
          await tx.roomAvailability.update({
            where: {
              roomId_date: {
                roomId: booking.roomId,
                date
              }
            },
            data: {
              bookedCount: newBookedCount
            }
          })
        }
      }

      // 3. Refund to user wallet balance
      const refundAmount = booking.totalPrice
      await tx.user.update({
        where: { id: userId },
        data: {
          walletBalance: { increment: refundAmount }
        }
      })

      // 4. Create WalletTransaction log
      await tx.walletTransaction.create({
        data: {
          userId,
          amount: refundAmount,
          reason: `Hotel Booking Cancellation Refund`,
          note: `Refund for booking ID: ${bookingId}`
        }
      })
    })

    return NextResponse.json({ success: true, message: "Booking cancelled and refund processed successfully." })

  } catch (error) {
    console.error("Cancellation error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
