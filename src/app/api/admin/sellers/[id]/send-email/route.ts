import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { sendAdminCustomSellerEmail } from "@/lib/email"

/**
 * POST /api/admin/sellers/[id]/send-email
 * Sends a custom email message from Admin to a specific seller (Product, Service, Hotel, Restaurant).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: "Seller ID is required" }, { status: 400 })
    }

    const body = await request.json()
    const { subject, message, sellerType } = body

    if (!subject || typeof subject !== "string" || !subject.trim()) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 })
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Message body is required" }, { status: 400 })
    }

    let recipientEmail: string | null = null
    let recipientName: string | null = null
    let businessName: string | null = null

    const normalizedType = sellerType ? String(sellerType).toUpperCase() : null

    // 1. Check Restaurant Seller
    if (normalizedType === "RESTAURANT") {
      const restaurant = await prisma.restaurantSeller.findUnique({
        where: { id },
        include: { user: true, businessInfo: true },
      })
      if (restaurant) {
        recipientEmail = restaurant.user?.email || null
        recipientName = restaurant.user?.name || null
        businessName = restaurant.businessInfo?.businessName || null
      }
    }
    // 2. Check Hotel Seller
    else if (normalizedType === "HOTEL") {
      const hotel = await prisma.hotelSeller.findUnique({
        where: { id },
        include: { user: true, businessInfo: true },
      })
      if (hotel) {
        recipientEmail = hotel.user?.email || null
        recipientName = hotel.user?.name || null
        businessName = hotel.businessInfo?.businessName || null
      }
    }
    // 3. Check Product / Service Seller
    else if (normalizedType === "PRODUCT" || normalizedType === "SERVICE") {
      const seller = await prisma.seller.findUnique({
        where: { id },
        include: { user: true, store: true, businessInfo: true },
      })
      if (seller) {
        recipientEmail = seller.user?.email || null
        recipientName = seller.user?.name || null
        businessName = seller.store?.name || seller.businessInfo?.businessName || null
      }
    }
    // 4. Fallback search if type not explicitly supplied
    else {
      const seller = await prisma.seller.findUnique({
        where: { id },
        include: { user: true, store: true, businessInfo: true },
      })
      if (seller) {
        recipientEmail = seller.user?.email || null
        recipientName = seller.user?.name || null
        businessName = seller.store?.name || seller.businessInfo?.businessName || null
      } else {
        const hotel = await prisma.hotelSeller.findUnique({
          where: { id },
          include: { user: true, businessInfo: true },
        })
        if (hotel) {
          recipientEmail = hotel.user?.email || null
          recipientName = hotel.user?.name || null
          businessName = hotel.businessInfo?.businessName || null
        } else {
          const restaurant = await prisma.restaurantSeller.findUnique({
            where: { id },
            include: { user: true, businessInfo: true },
          })
          if (restaurant) {
            recipientEmail = restaurant.user?.email || null
            recipientName = restaurant.user?.name || null
            businessName = restaurant.businessInfo?.businessName || null
          }
        }
      }
    }

    if (!recipientEmail) {
      return NextResponse.json(
        { error: "Seller or recipient email address not found" },
        { status: 404 }
      )
    }

    const emailResult = await sendAdminCustomSellerEmail({
      to: recipientEmail,
      sellerName: recipientName,
      businessName,
      subject: subject.trim(),
      message: message.trim(),
      adminName: session.user.name || "Administrator",
    })

    if (!emailResult.success) {
      return NextResponse.json(
        { error: emailResult.error?.message || "Failed to send email via mail service" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Email successfully sent to ${recipientEmail}`,
      recipient: {
        email: recipientEmail,
        name: recipientName,
        businessName,
      },
    })
  } catch (error: any) {
    console.error("Error sending custom email to seller:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
