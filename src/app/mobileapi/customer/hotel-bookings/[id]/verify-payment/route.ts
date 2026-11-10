import { NextRequest, NextResponse } from "next/server"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { prisma } from "@/lib/prisma"
import { queryAfriMoneyTransaction } from "@/lib/afrimoney"
import { creditHotelSellerForBooking } from "@/lib/hotel-ledger"

export const dynamic = "force-dynamic"

export async function GET(
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
    include: {
      hotel: {
        include: { hotelSeller: true },
      },
    },
  })

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  if (booking.paymentStatus === "COMPLETED" || booking.paymentStatus === "FAILED") {
    return NextResponse.json({
      success: booking.paymentStatus === "COMPLETED",
      paymentStatus: booking.paymentStatus,
      status: booking.status,
      paidAt: booking.paidAt,
      afriTxnId: booking.afriTxnId,
    })
  }

  // Fallback query to AfriMoney if external reference exists
  if (booking.afriFtxnId) {
    try {
      const enqRes = await queryAfriMoneyTransaction(booking.afriFtxnId).catch(() => null)
      const txnStatus = enqRes?.COMMAND?.TXNSTATUS || enqRes?.txn_status || ""
      const isSuccess = txnStatus.toUpperCase() === "TS" || txnStatus.toUpperCase() === "SUCCESS"
      const isFailed = txnStatus.toUpperCase() === "TF" || txnStatus.toUpperCase().includes("FAIL")

      if (isSuccess) {
        const txnId = enqRes?.COMMAND?.TXNID || enqRes?.transaction_id || null
        await prisma.hotelBooking.update({
          where: { id: booking.id },
          data: {
            paymentStatus: "COMPLETED",
            status: "CONFIRMED",
            settlementStatus: "ESCROW_HELD",
            afriTxnId: txnId || booking.afriTxnId,
            paidAt: new Date(),
          },
        })

        // Ledger credit upon verified booking
        await creditHotelSellerForBooking(prisma, booking.id).catch((err) =>
          console.error("Error crediting hotel seller:", err)
        )

        return NextResponse.json({
          success: true,
          paymentStatus: "COMPLETED",
          status: "CONFIRMED",
          paidAt: new Date(),
          afriTxnId: txnId || booking.afriTxnId,
        })
      } else if (isFailed) {
        await prisma.hotelBooking.update({
          where: { id: booking.id },
          data: {
            paymentStatus: "FAILED",
            status: "CANCELLED",
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
          console.warn("[Mobile Verify Payment] Could not release room availability:", availErr)
        }

        await prisma.couponUsage.deleteMany({
          where: { hotelBookingId: booking.id },
        }).catch(() => null)

        return NextResponse.json({
          success: false,
          paymentStatus: "FAILED",
          status: "CANCELLED",
        })
      }
    } catch (queryErr) {
      console.warn("[Mobile Verify Payment] AfriMoney transaction query error:", queryErr)
    }
  }

  return NextResponse.json({
    success: false,
    paymentStatus: booking.paymentStatus,
    status: booking.status,
  })
}
