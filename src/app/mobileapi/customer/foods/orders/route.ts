import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyMobileAccessToken } from "@/lib/mobile-jwt"
import { sendFoodOrderConfirmationEmail, sendRestaurantNewOrderEmail, sendAdminNewOrderEmail } from "@/lib/email"
import { validateCoupon } from "@/lib/coupons"

export const dynamic = "force-dynamic"

function getCustomerId(request: NextRequest): string | null {
  const auth = request.headers.get("Authorization")
  if (!auth?.startsWith("Bearer ")) return null
  const token = auth.slice(7).trim()
  const payload = verifyMobileAccessToken(token)
  if (!payload || payload.role !== "CUSTOMER") return null
  return payload.userId
}

// GET: List authenticated customer's food orders
export async function GET(request: NextRequest) {
  try {
    const userId = getCustomerId(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const orders = await prisma.foodOrder.findMany({
      where: { customerId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        restaurantSeller: {
          include: {
            businessInfo: {
              select: {
                businessName: true
              }
            },
            user: {
              select: {
                name: true
              }
            }
          }
        }
      }
    })

    const formatted = orders.map(o => ({
      id: o.id,
      orderNumber: o.orderNumber,
      totalAmount: o.totalAmount,
      status: o.status,
      createdAt: o.createdAt,
      restaurantName: o.restaurantSeller.businessInfo?.businessName || o.restaurantSeller.user.name || "Restaurant"
    }))

    return NextResponse.json({
      success: true,
      data: formatted
    })
  } catch (error: any) {
    console.error("Mobile list customer food orders error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

// POST: Place a food order
export async function POST(request: NextRequest) {
  try {
    const userId = getCustomerId(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      restaurantSellerId,
      items, // Array of { foodItemId, quantity }
      deliveryFullName,
      deliveryPhone,
      deliveryAddressLine1,
      deliveryAddressLine2,
      deliveryCity,
      deliveryState,
      deliveryPostalCode,
      deliveryCountry,
      couponCode
    } = body

    if (!restaurantSellerId || !items || !Array.isArray(items) || items.length === 0 || !deliveryFullName || !deliveryPhone || !deliveryAddressLine1 || !deliveryCity || !deliveryState || !deliveryPostalCode || !deliveryCountry) {
      return NextResponse.json({ success: false, error: "Missing required order checkout details" }, { status: 400 })
    }

    // Verify restaurant seller exists
    const seller = await prisma.restaurantSeller.findFirst({
      where: { id: restaurantSellerId, isApproved: true }
    })
    if (!seller) {
      return NextResponse.json({ success: false, error: "Restaurant seller not found or inactive" }, { status: 404 })
    }

    // Process items in a Prisma Transaction
    const result = await prisma.$transaction(async (tx) => {
      let subtotalAmount = 0
      const orderItemsToCreate = []
      const couponItemsForValidation = []

      for (const item of items) {
        const food = await tx.foodItem.findFirst({
          where: { id: item.foodItemId, restaurantSellerId, isDeleted: false, isActive: true }
        })
        if (!food) {
          throw new Error(`Food item ${item.foodItemId} not found or inactive in this restaurant`)
        }

        const quantity = parseInt(String(item.quantity))
        if (isNaN(quantity) || quantity <= 0) {
          throw new Error("Quantity must be a positive integer")
        }

        const price = food.price
        const subtotal = price * quantity
        subtotalAmount += subtotal

        orderItemsToCreate.push({
          foodItemId: food.id,
          quantity,
          price,
          subtotal
        })

        couponItemsForValidation.push({
          foodItemId: food.id,
          price,
          quantity
        })
      }

      // Validate coupon if provided
      let couponId = null
      let couponCodeDb = null
      let couponDiscount = 0
      if (couponCode) {
        const validationResult = await validateCoupon({
          code: couponCode.trim().toUpperCase(),
          type: "FOOD",
          subtotal: subtotalAmount,
          items: couponItemsForValidation,
          userId
        })

        if (!validationResult.valid) {
          throw new Error(validationResult.error)
        }
        couponId = validationResult.coupon?.id || null
        couponCodeDb = validationResult.coupon?.code || null
        couponDiscount = validationResult.discountAmount || 0
      }

      const finalAmount = Math.max(0, subtotalAmount - couponDiscount)

      // Generate unique order number
      const now = new Date()
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "")
      const randomStr = Math.floor(1000 + Math.random() * 9000).toString()
      const orderNumber = `F-${dateStr}-${randomStr}`

      const order = await tx.foodOrder.create({
        data: {
          orderNumber,
          customerId: userId,
          restaurantSellerId,
          totalAmount: finalAmount,
          deliveryFullName,
          deliveryPhone,
          deliveryAddressLine1,
          deliveryAddressLine2,
          deliveryCity,
          deliveryState,
          deliveryPostalCode,
          deliveryCountry,
          couponId,
          couponCode: couponCodeDb,
          couponDiscount,
          status: "PENDING",
          items: {
            create: orderItemsToCreate
          }
        }
      })

      if (couponId) {
        await tx.couponUsage.create({
          data: {
            couponId,
            userId,
            foodOrderId: order.id
          }
        })
      }

      return order
    })

    // ── Send Email Notifications ───────────────────────────────────────────────
    try {
      const fullFoodOrder = await prisma.foodOrder.findUnique({
        where: { id: result.id },
        include: {
          customer: { select: { email: true, name: true } },
          restaurantSeller: {
            include: {
              user: { select: { email: true, name: true } },
              businessInfo: { select: { businessName: true } }
            }
          },
          items: {
            include: {
              foodItem: { select: { name: true } }
            }
          }
        }
      })

      if (fullFoodOrder && fullFoodOrder.customer) {
        const deliveryAddress = [
          fullFoodOrder.deliveryFullName,
          fullFoodOrder.deliveryPhone,
          fullFoodOrder.deliveryAddressLine1,
          fullFoodOrder.deliveryAddressLine2,
          `${fullFoodOrder.deliveryCity}, ${fullFoodOrder.deliveryState} ${fullFoodOrder.deliveryPostalCode}`,
          fullFoodOrder.deliveryCountry
        ].filter(Boolean).join(", ")

        const emailItems = fullFoodOrder.items.map(item => ({
          name: item.foodItem.name,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal
        }))

        await sendFoodOrderConfirmationEmail({
          to: fullFoodOrder.customer.email,
          name: fullFoodOrder.customer.name ?? "Customer",
          orderNumber: fullFoodOrder.orderNumber,
          items: emailItems,
          totalAmount: fullFoodOrder.totalAmount,
          deliveryAddress,
          paymentMethod: "COD"
        })

        if (fullFoodOrder.restaurantSeller?.user?.email) {
          await sendRestaurantNewOrderEmail({
            to: fullFoodOrder.restaurantSeller.user.email,
            restaurantName: fullFoodOrder.restaurantSeller.businessInfo?.businessName ?? fullFoodOrder.restaurantSeller.user.name ?? "Restaurant",
            orderNumber: fullFoodOrder.orderNumber,
            items: emailItems.map(i => ({ name: i.name, quantity: i.quantity })),
            customerName: fullFoodOrder.customer.name ?? "Customer",
            deliveryAddress,
            deliveryPhone: fullFoodOrder.deliveryPhone
          })
        }

        const admins = await prisma.user.findMany({
          where: { role: "ADMIN" },
          select: { email: true }
        })
        const adminItems = emailItems.map(i => ({
          name: i.name,
          quantity: i.quantity,
          sellerStoreName: fullFoodOrder.restaurantSeller.businessInfo?.businessName ?? fullFoodOrder.restaurantSeller.user.name ?? "Restaurant",
          subtotal: i.subtotal
        }))
        for (const admin of admins) {
          await sendAdminNewOrderEmail({
            to: admin.email,
            orderNumber: fullFoodOrder.orderNumber,
            customerName: fullFoodOrder.customer.name ?? "Customer",
            items: adminItems,
            totalAmount: fullFoodOrder.totalAmount,
            commissionAmount: 0
          })
        }
      }
    } catch (emailErr) {
      console.error("Failed to send food order placement emails:", emailErr)
    }

    return NextResponse.json({
      success: true,
      message: "Order placed successfully",
      data: result
    }, { status: 201 })
  } catch (error: any) {
    console.error("Mobile place food order error:", error)
    return NextResponse.json({ success: false, error: error.message || "Internal server error" }, { status: 500 })
  }
}
