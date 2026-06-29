import type { Prisma } from "@prisma/client"

export const HOTEL_REVENUE_REASON_BOOKING_CONFIRMED = "BOOKING_CONFIRMED"
export const HOTEL_REVENUE_REASON_BOOKING_CANCELLED = "BOOKING_CANCELLED"

export async function creditHotelSellerForBooking(
  tx: Prisma.TransactionClient,
  bookingId: string
): Promise<void> {
  const booking = await tx.hotelBooking.findUnique({
    where: { id: bookingId },
    include: {
      room: {
        include: {
          hotel: true
        }
      }
    }
  })

  if (!booking) return
  if (booking.status !== "CONFIRMED") return

  const hotelSellerId = booking.room.hotel.hotelSellerId

  // Check if already credited
  const existing = await tx.hotelBalanceTransaction.findFirst({
    where: {
      bookingId,
      reason: HOTEL_REVENUE_REASON_BOOKING_CONFIRMED
    }
  })
  if (existing) return

  const amount = booking.totalPrice

  // Increment seller netBalance
  await tx.hotelSeller.update({
    where: { id: hotelSellerId },
    data: {
      netBalance: { increment: amount }
    }
  })

  // Create ledger entry
  await tx.hotelBalanceTransaction.create({
    data: {
      hotelSellerId,
      amount,
      kind: "CREDIT",
      reason: HOTEL_REVENUE_REASON_BOOKING_CONFIRMED,
      bookingId,
      note: `Credited for room booking: ${booking.room.name} at hotel: ${booking.room.hotel.name}`
    }
  })
}

export async function debitHotelSellerForCancellation(
  tx: Prisma.TransactionClient,
  bookingId: string
): Promise<void> {
  const booking = await tx.hotelBooking.findUnique({
    where: { id: bookingId },
    include: {
      room: {
        include: {
          hotel: true
        }
      }
    }
  })

  if (!booking) return
  if (booking.status !== "CANCELLED") return

  const hotelSellerId = booking.room.hotel.hotelSellerId

  // Check if already debited
  const existing = await tx.hotelBalanceTransaction.findFirst({
    where: {
      bookingId,
      reason: HOTEL_REVENUE_REASON_BOOKING_CANCELLED
    }
  })
  if (existing) return

  const amount = booking.totalPrice

  // Decrement seller netBalance
  await tx.hotelSeller.update({
    where: { id: hotelSellerId },
    data: {
      netBalance: { decrement: amount }
    }
  })

  // Create ledger entry
  await tx.hotelBalanceTransaction.create({
    data: {
      hotelSellerId,
      amount,
      kind: "DEBIT",
      reason: HOTEL_REVENUE_REASON_BOOKING_CANCELLED,
      bookingId,
      note: `Debited due to cancellation of booking ID: ${bookingId}`
    }
  })
}
