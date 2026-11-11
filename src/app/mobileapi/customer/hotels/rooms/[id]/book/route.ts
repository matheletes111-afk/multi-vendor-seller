import { NextRequest, NextResponse } from "next/server"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { prisma } from "@/lib/prisma"
import { creditHotelSellerForBooking } from "@/lib/hotel-ledger"
import { sendHotelBookingConfirmationEmail, sendHotelNewBookingEmail, sendAdminNewOrderEmail } from "@/lib/email"
import { validateCoupon } from "@/lib/coupons"
import { isSellerSubscriptionActive } from "@/lib/subscriptions"
import { PlanType } from "@prisma/client"
import { initiateAfriMoneyPushUssd } from "@/lib/afrimoney"
import { createFlotPaymentLink } from "@/lib/flot"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getMobileCustomerAuth(request)
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: "Authentication required to book a room" }, { status: 401 })
    }

    const userId = auth.userId
    const { id: roomId } = await params
    const body = await request.json().catch(() => ({}))
    const {
      checkIn,
      checkOut,
      numberOfRooms = 1,
      guestName,
      guestPhone,
      adults = 2,
      children = 0,
      couponCode,
      paymentMethod,
      payerMsisdn,
    } = body

    const requestedPaymentMethod =
      paymentMethod === "AFRIMONEY" ? "AFRIMONEY" : paymentMethod === "FLOAT" ? "FLOAT" : "COD"
    const payerPhone = typeof payerMsisdn === "string" ? payerMsisdn.trim() : (guestPhone ? String(guestPhone).trim() : "")

    if (requestedPaymentMethod === "AFRIMONEY" && !payerPhone) {
      return NextResponse.json({ success: false, error: "AfriMoney phone number (payerMsisdn) is required for AfriMoney payment" }, { status: 400 })
    }

    if (!checkIn || !checkOut || !guestName || !guestPhone) {
      return NextResponse.json({ success: false, error: "Missing required booking details (check-in, check-out, guest name/phone)" }, { status: 400 })
    }

    const checkInDate = new Date(checkIn)
    const checkOutDate = new Date(checkOut)

    // Normalize dates to start of day
    checkInDate.setHours(0, 0, 0, 0)
    checkOutDate.setHours(0, 0, 0, 0)

    const now = new Date()
    now.setHours(0, 0, 0, 0)

    if (checkInDate < now) {
      return NextResponse.json({ success: false, error: "Check-in date cannot be in the past" }, { status: 400 })
    }

    if (checkOutDate <= checkInDate) {
      return NextResponse.json({ success: false, error: "Check-out date must be after check-in date" }, { status: 400 })
    }

    const room = await prisma.room.findFirst({
      where: { id: roomId, isActive: true, isDeleted: false },
      include: { hotel: true }
    })

    if (!room) {
      return NextResponse.json({ success: false, error: "Room not found or no longer active" }, { status: 404 })
    }

    const isSubActive = await isSellerSubscriptionActive(PlanType.HOTEL, room.hotel.hotelSellerId)
    if (!isSubActive) {
      return NextResponse.json({ success: false, error: "This hotel is currently not accepting new bookings because its subscription has expired." }, { status: 400 })
    }

    // Validate numberOfRooms
    const roomsToBook = Math.max(1, parseInt(String(numberOfRooms), 10) || 1)
    if (roomsToBook > room.totalRooms) {
      return NextResponse.json({ success: false, error: `Maximum ${room.totalRooms} rooms can be booked for this category` }, { status: 400 })
    }

    // Generate list of dates of stay (excluding checkOut night)
    const stayDates: Date[] = []
    let currentDate = new Date(checkInDate)
    while (currentDate < checkOutDate) {
      stayDates.push(new Date(currentDate))
      currentDate.setDate(currentDate.getDate() + 1)
    }

    if (stayDates.length === 0) {
      return NextResponse.json({ success: false, error: "Stay duration must be at least 1 night" }, { status: 400 })
    }

    // Query availability for stay dates
    const availabilities = await prisma.roomAvailability.findMany({
      where: {
        roomId: room.id,
        date: { in: stayDates }
      }
    })

    let totalPrice = 0
    const availMap = new Map(availabilities.map((a) => [a.date.toDateString(), a]))

    for (const date of stayDates) {
      const avail = availMap.get(date.toDateString())
      if (avail) {
        if (avail.isBlocked) {
          return NextResponse.json({ success: false, error: `Room is unavailable/blocked on ${date.toLocaleDateString()}` }, { status: 400 })
        }
        if (avail.bookedCount + roomsToBook > room.totalRooms) {
          return NextResponse.json({ success: false, error: `Sold out: No rooms available on ${date.toLocaleDateString()}` }, { status: 400 })
        }
        totalPrice += (avail.priceOverride ?? room.price)
      } else {
        totalPrice += room.price
      }
    }

    totalPrice *= roomsToBook

    // Validate coupon
    let coupon = null
    let couponDiscount = 0
    if (couponCode) {
      const validationResult = await validateCoupon({
        code: couponCode.trim().toUpperCase(),
        type: "HOTEL",
        subtotal: totalPrice,
        items: [],
        userId
      })

      if (!validationResult.valid) {
        return NextResponse.json({ success: false, error: validationResult.error }, { status: 400 })
      }
      coupon = validationResult.coupon
      couponDiscount = validationResult.discountAmount || 0
    }

    const finalPrice = Math.max(0, totalPrice - couponDiscount)

    const hotelSellerRec = await prisma.hotelSeller.findUnique({
      where: { id: room.hotel.hotelSellerId },
      select: { commissionRate: true },
    })
    const globalSetting = await prisma.globalSetting.findFirst().catch(() => null)
    const defaultRate = globalSetting?.hotelBaseCommission ?? 10.0
    const commRate = typeof hotelSellerRec?.commissionRate === "number" ? hotelSellerRec.commissionRate : defaultRate
    const commAmount = Number(((totalPrice * commRate) / 100).toFixed(2))
    const sellerNetPayout = Math.max(0, Number((totalPrice - commAmount).toFixed(2)))

    // Perform transaction to create booking and update RoomAvailability records
    const booking = await prisma.$transaction(async (tx) => {
      const newBooking = await tx.hotelBooking.create({
        data: {
          userId,
          roomId: room.id,
          hotelId: room.hotelId,
          guestName: guestName.trim(),
          guestPhone: guestPhone.trim(),
          checkIn: checkInDate,
          checkOut: checkOutDate,
          numberOfRooms: roomsToBook,
          adults,
          children,
          subtotal: totalPrice,
          commissionRate: commRate,
          commissionAmount: commAmount,
          sellerNetPayout,
          paymentMethod: requestedPaymentMethod,
          paymentStatus: "PENDING",
          settlementStatus: requestedPaymentMethod === "AFRIMONEY" ? "ESCROW_HELD" : "PENDING",
          totalPrice: finalPrice,
          couponId: coupon ? coupon.id : null,
          couponCode: coupon ? coupon.code : null,
          couponDiscount,
          status: requestedPaymentMethod === "AFRIMONEY" ? "PENDING" : "CONFIRMED"
        },
        include: { room: { include: { hotel: true } } }
      })

      if (coupon) {
        await tx.couponUsage.create({
          data: {
            couponId: coupon.id,
            userId,
            hotelBookingId: newBooking.id
          }
        })
      }

      // Only credit hotel seller immediately if cash on arrival
      if (requestedPaymentMethod !== "AFRIMONEY" && requestedPaymentMethod !== "FLOAT") {
        await creditHotelSellerForBooking(tx, newBooking.id)
      }

      // Increment bookedCount for each date
      for (const date of stayDates) {
        await tx.roomAvailability.upsert({
          where: {
            roomId_date: {
              roomId: room.id,
              date
            }
          },
          update: {
            bookedCount: { increment: roomsToBook }
          },
          create: {
            roomId: room.id,
            date,
            bookedCount: roomsToBook,
            isBlocked: false
          }
        })
      }

      return newBooking
    })

    let afriTxnId: string | undefined = undefined
    let ussdPromptSent = false
    let pushMessage = ""

    if (requestedPaymentMethod === "AFRIMONEY") {
      const externalRef = `HOTEL_${booking.id}`
      try {
        const pushResult = await initiateAfriMoneyPushUssd({
          amount: booking.totalPrice,
          payerMsisdn: payerPhone,
          externalReferenceId: externalRef,
          remarks: `Hotel Booking ${booking.id}`,
        })

        if (pushResult.success) {
          ussdPromptSent = true
          afriTxnId = pushResult.txnId
          pushMessage = pushResult.message || "USSD push prompt sent to your phone. Please enter your AfriMoney PIN."
          await prisma.hotelBooking.update({
            where: { id: booking.id },
            data: {
              afriFtxnId: externalRef,
              afriTxnId: pushResult.txnId || null,
              afriMsisdn: payerPhone,
            },
          })
        } else {
          for (const date of stayDates) {
            await prisma.roomAvailability.updateMany({
              where: { roomId: room.id, date },
              data: { bookedCount: { decrement: roomsToBook } },
            }).catch(() => null)
          }
          await prisma.couponUsage.deleteMany({
            where: { hotelBookingId: booking.id },
          }).catch(() => null)
          await prisma.hotelBooking.delete({ where: { id: booking.id } }).catch(() => null)
          return NextResponse.json(
            { success: false, error: pushResult.message || "Failed to initiate AfriMoney USSD payment. Please check your phone number and try again." },
            { status: 400 }
          )
        }
      } catch (pushErr: any) {
        for (const date of stayDates) {
          await prisma.roomAvailability.updateMany({
            where: { roomId: room.id, date },
            data: { bookedCount: { decrement: roomsToBook } },
          }).catch(() => null)
        }
        await prisma.couponUsage.deleteMany({
          where: { hotelBookingId: booking.id },
        }).catch(() => null)
        await prisma.hotelBooking.delete({ where: { id: booking.id } }).catch(() => null)
        return NextResponse.json(
          { success: false, error: `AfriMoney connection error: ${pushErr?.message || "Payment service unavailable"}` },
          { status: 502 }
        )
      }
    }

    let flotPaymentLink: string | null = null
    let flotOrderId: string | null = null
    let flotInternalOrderId: string | null = null

    if (requestedPaymentMethod === "FLOAT") {
      const extOrderId = `HOTEL_${booking.id}`
      try {
        const flotRes = await createFlotPaymentLink({
          orderId: extOrderId,
          amount: booking.totalPrice,
          type: "card",
        })

        if (flotRes.link) {
          flotPaymentLink = flotRes.link
          flotOrderId = extOrderId
          flotInternalOrderId = flotRes.id || null

          await prisma.hotelBooking.update({
            where: { id: booking.id },
            data: {
              flotOrderId,
              flotInternalOrderId,
              flotPaymentLink,
            },
          })
        } else {
          throw new Error("No payment link received from Float payment gateway")
        }
      } catch (flotErr: any) {
        for (const date of stayDates) {
          await prisma.roomAvailability.updateMany({
            where: { roomId: room.id, date },
            data: { bookedCount: { decrement: roomsToBook } },
          }).catch(() => null)
        }
        await prisma.couponUsage.deleteMany({
          where: { hotelBookingId: booking.id },
        }).catch(() => null)
        await prisma.hotelBooking.delete({ where: { id: booking.id } }).catch(() => null)
        return NextResponse.json(
          { success: false, error: `Float gateway error: ${flotErr?.message || "Could not generate payment link"}` },
          { status: 502 }
        )
      }
    }

    // ── Send Email Notifications (Only for COD here; for AfriMoney and Float, sent upon payment confirmation)
    if (requestedPaymentMethod !== "AFRIMONEY" && requestedPaymentMethod !== "FLOAT") {
      try {
      const customerUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true, phone: true, phoneCountryCode: true }
      })

      if (customerUser) {
        // Send Customer Email / SMS fallback
        await sendHotelBookingConfirmationEmail({
          to: customerUser.email,
          toPhone: customerUser.phone,
          phoneCountryCode: customerUser.phoneCountryCode,
          name: customerUser.name ?? "Customer",
          hotelName: room.hotel.name,
          roomName: room.name,
          guestName: booking.guestName,
          guestPhone: booking.guestPhone,
          checkInDate: checkInDate.toLocaleDateString(),
          checkOutDate: checkOutDate.toLocaleDateString(),
          numberOfRooms: roomsToBook,
          totalPrice: finalPrice,
        })

        // Send Hotel Seller Email / SMS fallback
        const hotelSeller = await prisma.hotelSeller.findUnique({
          where: { id: room.hotel.hotelSellerId },
          include: { user: { select: { email: true, name: true, phone: true, phoneCountryCode: true } } }
        })

        if (hotelSeller?.user?.email || hotelSeller?.user?.phone) {
          await sendHotelNewBookingEmail({
            to: hotelSeller.user?.email,
            toPhone: hotelSeller.user?.phone,
            phoneCountryCode: hotelSeller.user?.phoneCountryCode,
            hotelSellerName: hotelSeller.user?.name ?? "Hotel Partner",
            hotelName: room.hotel.name,
            roomName: room.name,
            guestName: booking.guestName,
            guestPhone: booking.guestPhone,
            checkInDate: checkInDate.toLocaleDateString(),
            checkOutDate: checkOutDate.toLocaleDateString(),
            numberOfRooms: roomsToBook,
            totalPrice: finalPrice,
          })
        }

        // Send Admin Emails
        const admins = await prisma.user.findMany({
          where: { role: "ADMIN" },
          select: { email: true, phone: true, phoneCountryCode: true }
        })

        const adminItems = [{
          name: `Booking - Room: ${room.name} at ${room.hotel.name}`,
          quantity: roomsToBook,
          sellerStoreName: room.hotel.name,
          subtotal: finalPrice,
        }]

        for (const admin of admins) {
          await sendAdminNewOrderEmail({
            to: admin.email,
            toPhone: admin.phone,
            phoneCountryCode: admin.phoneCountryCode,
            orderNumber: booking.id,
            customerName: customerUser.name ?? "Customer",
            items: adminItems,
            totalAmount: finalPrice,
            commissionAmount: commAmount,
          })
        }
      }
    } catch (emailErr) {
      console.error("Failed to send hotel booking confirmation emails:", emailErr)
    }
  }

    return NextResponse.json({
      success: true,
      message:
        requestedPaymentMethod === "AFRIMONEY"
          ? "AfriMoney prompt sent"
          : requestedPaymentMethod === "FLOAT"
          ? "Float payment link created"
          : "Booking confirmed successfully",
      data: booking,
      paymentMethod: requestedPaymentMethod,
      ussdPromptSent,
      afriTxnId,
      flotPaymentLink,
      flotOrderId,
      promptMessage: pushMessage,
    })
  } catch (error) {
    console.error("Mobile booking error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
