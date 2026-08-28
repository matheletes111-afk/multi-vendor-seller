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

  const [seller, globalSetting] = await Promise.all([
    tx.hotelSeller.findUnique({
      where: { id: hotelSellerId },
      select: { commissionRate: true },
    }),
    (tx as any).globalSetting.findFirst({
      select: { baseCommission: true, hotelBaseCommission: true },
    }) as Promise<{ baseCommission?: number; hotelBaseCommission?: number } | null>,
  ])

  const commissionPct =
    seller?.commissionRate ??
    globalSetting?.hotelBaseCommission ??
    globalSetting?.baseCommission ??
    10.0

  const grossAmount = booking.totalPrice
  const commissionAmount = Math.round(grossAmount * (commissionPct / 100) * 100) / 100
  const netAmount = Math.max(0, Math.round((grossAmount - commissionAmount) * 100) / 100)

  // Increment seller netBalance by netAmount after commission
  await tx.hotelSeller.update({
    where: { id: hotelSellerId },
    data: {
      netBalance: { increment: netAmount }
    }
  })

  // Create ledger entry
  await tx.hotelBalanceTransaction.create({
    data: {
      hotelSellerId,
      amount: netAmount,
      kind: "CREDIT",
      reason: HOTEL_REVENUE_REASON_BOOKING_CONFIRMED,
      bookingId,
      note: `Credited for room booking: ${booking.room.name} at hotel: ${booking.room.hotel.name} (Gross: $${grossAmount.toFixed(2)}, Commission ${commissionPct}%: -$${commissionAmount.toFixed(2)})`
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

  // Find original credit to reverse the exact net amount
  const existingCredit = await tx.hotelBalanceTransaction.findFirst({
    where: {
      bookingId,
      reason: HOTEL_REVENUE_REASON_BOOKING_CONFIRMED,
      kind: "CREDIT",
    }
  })

  let debitAmount = booking.totalPrice
  if (existingCredit) {
    debitAmount = Number(existingCredit.amount)
  } else {
    const [seller, globalSetting] = await Promise.all([
      tx.hotelSeller.findUnique({
        where: { id: hotelSellerId },
        select: { commissionRate: true },
      }),
      (tx as any).globalSetting.findFirst({
        select: { baseCommission: true, hotelBaseCommission: true },
      }) as Promise<{ baseCommission?: number; hotelBaseCommission?: number } | null>,
    ])

    const commissionPct =
      seller?.commissionRate ??
      globalSetting?.hotelBaseCommission ??
      globalSetting?.baseCommission ??
      10.0

    const commissionAmount = Math.round(booking.totalPrice * (commissionPct / 100) * 100) / 100
    debitAmount = Math.max(0, Math.round((booking.totalPrice - commissionAmount) * 100) / 100)
  }

  // Decrement seller netBalance
  await tx.hotelSeller.update({
    where: { id: hotelSellerId },
    data: {
      netBalance: { decrement: debitAmount }
    }
  })

  // Create ledger entry
  await tx.hotelBalanceTransaction.create({
    data: {
      hotelSellerId,
      amount: debitAmount,
      kind: "DEBIT",
      reason: HOTEL_REVENUE_REASON_BOOKING_CANCELLED,
      bookingId,
      note: `Debited due to cancellation of booking ID: ${bookingId} ($${debitAmount.toFixed(2)})`
    }
  })
}
