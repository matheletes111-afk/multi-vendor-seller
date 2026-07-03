import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { creditHotelSellerForBooking } from "@/lib/hotel-ledger"
import { sendHotelBookingConfirmationEmail, sendHotelNewBookingEmail, sendAdminNewOrderEmail } from "@/lib/email"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user || !session.user.id) {
      return NextResponse.json({ success: false, error: "Authentication required to book a room" }, { status: 401 })
    }

    if (session.user.role !== "CUSTOMER") {
      return NextResponse.json({ success: false, error: "Only users with the customer role can book hotel rooms" }, { status: 403 })
    }

    const { id: roomId } = await params
    const body = await request.json().catch(() => ({}))
    const { checkIn, checkOut, numberOfRooms = 1, guestName, guestPhone, adults = 2, children = 0 } = body

    if (!checkIn || !checkOut || !guestName || !guestPhone) {
      return NextResponse.json({ success: false, error: "Missing required booking details (check-in, check-out, guest name/phone)" }, { status: 400 })
    }

    const checkInDate = new Date(checkIn)
    const checkOutDate = new Date(checkOut)

    // Normalize dates to start of day to avoid timezone hours skewing stay calculations
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

    // Validate numberOfRooms within range
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

    // Query availability for all stay dates
    const availabilities = await prisma.roomAvailability.findMany({
      where: {
        roomId: room.id,
        date: { in: stayDates }
      }
    })

    // Check availability and calculate price for each date
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

    // Perform transaction to create booking and update/upsert RoomAvailability records
    const booking = await prisma.$transaction(async (tx) => {
      // Create the HotelBooking record
      const newBooking = await tx.hotelBooking.create({
        data: {
          userId: session.user.id!,
          roomId: room.id,
          hotelId: room.hotelId,
          guestName: guestName.trim(),
          guestPhone: guestPhone.trim(),
          checkIn: checkInDate,
          checkOut: checkOutDate,
          numberOfRooms: roomsToBook,
          adults,
          children,
          totalPrice,
          status: "CONFIRMED"
        },
        include: { room: { include: { hotel: true } } }
      })

      // Credit the hotel seller balance & create ledger transaction
      await creditHotelSellerForBooking(tx, newBooking.id)

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

    // ── Send Email Notifications ───────────────────────────────────────────────
    try {
      const customerUser = await prisma.user.findUnique({
        where: { id: session.user.id! },
        select: { email: true, name: true }
      })

      if (customerUser) {
        // Send Customer Email
        await sendHotelBookingConfirmationEmail({
          to: customerUser.email,
          name: customerUser.name ?? "Customer",
          hotelName: room.hotel.name,
          roomName: room.name,
          guestName: booking.guestName,
          guestPhone: booking.guestPhone,
          checkInDate: checkInDate.toLocaleDateString(),
          checkOutDate: checkOutDate.toLocaleDateString(),
          numberOfRooms: roomsToBook,
          totalPrice,
        })

        // Send Hotel Seller Email
        const hotelSeller = await prisma.hotelSeller.findUnique({
          where: { id: room.hotel.hotelSellerId },
          include: { user: { select: { email: true, name: true } } }
        })

        if (hotelSeller?.user?.email) {
          await sendHotelNewBookingEmail({
            to: hotelSeller.user.email,
            hotelSellerName: hotelSeller.user.name ?? "Hotel Partner",
            hotelName: room.hotel.name,
            roomName: room.name,
            guestName: booking.guestName,
            guestPhone: booking.guestPhone,
            checkInDate: checkInDate.toLocaleDateString(),
            checkOutDate: checkOutDate.toLocaleDateString(),
            numberOfRooms: roomsToBook,
            totalPrice,
          })
        }

        // Send Admin Emails
        const admins = await prisma.user.findMany({
          where: { role: "ADMIN" },
          select: { email: true }
        })

        const adminItems = [{
          name: `Booking - Room: ${room.name} at ${room.hotel.name}`,
          quantity: roomsToBook,
          sellerStoreName: room.hotel.name,
          subtotal: totalPrice,
        }]

        for (const admin of admins) {
          await sendAdminNewOrderEmail({
            to: admin.email,
            orderNumber: booking.id,
            customerName: customerUser.name ?? "Customer",
            items: adminItems,
            totalAmount: totalPrice,
            commissionAmount: 0
          })
        }
      }
    } catch (emailErr) {
      console.error("Failed to send hotel booking confirmation emails:", emailErr)
    }

    return NextResponse.json({ success: true, message: "Booking confirmed successfully", data: booking })
  } catch (error) {
    console.error("Booking error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
