import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { sendFoodOrderConfirmationEmail, sendRestaurantNewOrderEmail, sendAdminNewOrderEmail } from "@/lib/email"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || !session.user || session.user.role !== "CUSTOMER") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const perPage = parseInt(searchParams.get("perPage") || "10")
    const q = searchParams.get("q") || ""
    const status = searchParams.get("status") || ""

    const skip = (page - 1) * perPage
    const take = perPage

    const baseWhere: any = { customerId: session.user.id }

    if (status && status !== "ALL") {
      baseWhere.status = status
    }

    if (q) {
      baseWhere.OR = [
        { orderNumber: { contains: q, mode: "insensitive" } },
        {
          restaurantSeller: {
            businessInfo: {
              businessName: { contains: q, mode: "insensitive" }
            }
          }
        }
      ]
    }

    const [orders, totalCount] = await Promise.all([
      prisma.foodOrder.findMany({
        where: baseWhere,
        skip,
        take,
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
      }),
      prisma.foodOrder.count({ where: baseWhere })
    ])

    const totalPages = Math.ceil(totalCount / perPage) || 1

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
      data: formatted,
      pagination: {
        totalCount,
        totalPages,
        page,
        perPage
      }
    })
  } catch (error) {
    console.error("Web get customer food orders error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || !session.user || session.user.role !== "CUSTOMER") {
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
      deliveryCountry
    } = body

    if (!restaurantSellerId || !items || !Array.isArray(items) || items.length === 0 || !deliveryFullName || !deliveryPhone || !deliveryAddressLine1 || !deliveryCity || !deliveryState || !deliveryPostalCode || !deliveryCountry) {
      return NextResponse.json({ success: false, error: "Missing required order checkout details" }, { status: 400 })
    }

    const seller = await prisma.restaurantSeller.findFirst({
      where: { id: restaurantSellerId, isApproved: true }
    })
    if (!seller) {
      return NextResponse.json({ success: false, error: "Restaurant seller not found or inactive" }, { status: 404 })
    }

    const result = await prisma.$transaction(async (tx) => {
      let totalAmount = 0
      const orderItemsToCreate = []

      for (const item of items) {
        const food = await tx.foodItem.findFirst({
          where: { id: item.foodItemId, restaurantSellerId, isDeleted: false, isActive: true }
        })
        if (!food) {
          throw new Error(`Food item ${item.foodItemId} not found or inactive`)
        }

        const quantity = parseInt(String(item.quantity))
        if (isNaN(quantity) || quantity <= 0) {
          throw new Error("Quantity must be a positive integer")
        }

        const price = food.price
        const subtotal = price * quantity
        totalAmount += subtotal

        orderItemsToCreate.push({
          foodItemId: food.id,
          quantity,
          price,
          subtotal
        })
      }

      const now = new Date()
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "")
      const randomStr = Math.floor(1000 + Math.random() * 9000).toString()
      const orderNumber = `F-${dateStr}-${randomStr}`

      const order = await tx.foodOrder.create({
        data: {
          orderNumber,
          customerId: session.user.id,
          restaurantSellerId,
          totalAmount,
          deliveryFullName,
          deliveryPhone,
          deliveryAddressLine1,
          deliveryAddressLine2,
          deliveryCity,
          deliveryState,
          deliveryPostalCode,
          deliveryCountry,
          status: "PENDING",
          items: {
            create: orderItemsToCreate
          }
        }
      })

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

    return NextResponse.json({ success: true, data: result }, { status: 201 })
  } catch (error: any) {
    console.error("Web place food order error:", error)
    return NextResponse.json({ success: false, error: error.message || "Internal server error" }, { status: 500 })
  }
}
