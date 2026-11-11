import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { sendFoodOrderConfirmationEmail, sendRestaurantNewOrderEmail, sendAdminNewOrderEmail } from "@/lib/email"
import { validateCoupon } from "@/lib/coupons"
import { isSellerSubscriptionActive } from "@/lib/subscriptions"
import { PlanType } from "@prisma/client"
import { initiateAfriMoneyPushUssd } from "@/lib/afrimoney"
import { createFlotPaymentLink } from "@/lib/flot"

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
      subtotal: o.subtotal,
      deliveryFee: o.deliveryFee,
      couponCode: o.couponCode,
      couponDiscount: o.couponDiscount,
      paymentMethod: o.paymentMethod ?? "COD",
      paymentStatus: o.paymentStatus,
      afriTxnId: o.afriTxnId,
      flotOrderId: o.flotOrderId,
      paidAt: o.paidAt,
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
      deliveryCountry,
      couponCode,
      paymentMethod,
      payerMsisdn
    } = body

    const requestedPaymentMethod =
      paymentMethod === "AFRIMONEY"
        ? "AFRIMONEY"
        : paymentMethod === "FLOAT"
        ? "FLOAT"
        : "COD"
    const payerPhone = typeof payerMsisdn === "string" ? payerMsisdn.trim() : ""

    if (requestedPaymentMethod === "AFRIMONEY" && !payerPhone) {
      return NextResponse.json({ success: false, error: "AfriMoney phone number (payerMsisdn) is required for AfriMoney payment" }, { status: 400 })
    }

    if (!restaurantSellerId || !items || !Array.isArray(items) || items.length === 0 || !deliveryFullName || !deliveryPhone || !deliveryAddressLine1 || !deliveryCity || !deliveryState || !deliveryPostalCode || !deliveryCountry) {
      return NextResponse.json({ success: false, error: "Missing required order checkout details" }, { status: 400 })
    }

    const seller = await prisma.restaurantSeller.findFirst({
      where: { id: restaurantSellerId, isApproved: true }
    })
    if (!seller) {
      return NextResponse.json({ success: false, error: "Restaurant seller not found or inactive" }, { status: 404 })
    }

    const isSubActive = await isSellerSubscriptionActive(PlanType.RESTAURANT, restaurantSellerId)
    if (!isSubActive) {
      return NextResponse.json({ success: false, error: "This restaurant is currently not accepting new orders because its subscription has expired." }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      let subtotalAmount = 0
      const orderItemsToCreate = []
      const couponItemsForValidation = []

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

        const price = Math.max(0, food.price - (food.discount || 0))
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
          userId: session.user.id
        })

        if (!validationResult.valid) {
          throw new Error(validationResult.error)
        }
        couponId = validationResult.coupon?.id || null
        couponCodeDb = validationResult.coupon?.code || null
        couponDiscount = validationResult.discountAmount || 0
      }

      const finalAmount = Math.max(0, subtotalAmount - couponDiscount)

      const now = new Date()
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "")
      const randomStr = Math.floor(1000 + Math.random() * 9000).toString()
      const orderNumber = `F-${dateStr}-${randomStr}`

      const globalSetting = await tx.globalSetting.findFirst().catch(() => null)
      const defaultRate = globalSetting?.restaurantBaseCommission ?? 10.0
      const commRate = typeof seller.commissionRate === "number" ? seller.commissionRate : defaultRate
      const commAmount = Number(((subtotalAmount * commRate) / 100).toFixed(2))
      const sellerNetPayout = Math.max(0, Number((subtotalAmount - commAmount).toFixed(2)))

      const order = await tx.foodOrder.create({
        data: {
          orderNumber,
          customerId: session.user.id,
          restaurantSellerId,
          subtotal: subtotalAmount,
          deliveryFee: 0,
          commissionRate: commRate,
          commissionAmount: commAmount,
          sellerNetPayout,
          paymentMethod: requestedPaymentMethod,
          paymentStatus: "PENDING",
          settlementStatus: requestedPaymentMethod === "AFRIMONEY" ? "ESCROW_HELD" : "PENDING",
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
            userId: session.user.id,
            foodOrderId: order.id
          }
        })
      }

      return order
    })

    let afriTxnId: string | undefined = undefined
    let ussdPromptSent = false
    let pushMessage = ""
    let flotPaymentLink: string | null = null
    let flotOrderId: string | null = null

    if (requestedPaymentMethod === "AFRIMONEY") {
      const externalRef = `FOOD_${result.id}`
      try {
        const pushResult = await initiateAfriMoneyPushUssd({
          amount: result.totalAmount,
          payerMsisdn: payerPhone,
          externalReferenceId: externalRef,
          remarks: `Food Order ${result.orderNumber}`,
        })

        if (pushResult.success) {
          ussdPromptSent = true
          afriTxnId = pushResult.txnId
          pushMessage = pushResult.message || "USSD push prompt sent to your phone. Please enter your AfriMoney PIN."
          await prisma.foodOrder.update({
            where: { id: result.id },
            data: {
              afriFtxnId: externalRef,
              afriTxnId: pushResult.txnId || null,
              afriMsisdn: payerPhone,
            },
          })
        } else {
          // Push failed - rollback
          await prisma.couponUsage.deleteMany({
            where: { foodOrderId: result.id },
          }).catch(() => null)
          await prisma.foodOrder.delete({ where: { id: result.id } }).catch(() => null)
          return NextResponse.json(
            { success: false, error: pushResult.message || "Failed to initiate AfriMoney USSD payment. Please check your phone number and try again." },
            { status: 400 }
          )
        }
      } catch (pushErr: any) {
        await prisma.couponUsage.deleteMany({
          where: { foodOrderId: result.id },
        }).catch(() => null)
        await prisma.foodOrder.delete({ where: { id: result.id } }).catch(() => null)
        return NextResponse.json(
          { success: false, error: `AfriMoney connection error: ${pushErr?.message || "Payment service unavailable"}` },
          { status: 502 }
        )
      }
    } else if (requestedPaymentMethod === "FLOAT") {
      const externalRef = `FOOD_${result.id}`
      try {
        const flotRes = await createFlotPaymentLink({
          orderId: externalRef,
          amount: result.totalAmount,
          currency: "SLE",
          type: "card",
        })

        flotPaymentLink = flotRes.link
        flotOrderId = externalRef

        await prisma.foodOrder.update({
          where: { id: result.id },
          data: {
            flotOrderId: externalRef,
            flotInternalOrderId: flotRes.id,
            flotPaymentLink: flotRes.link,
            paymentMethod: "FLOAT",
          },
        })
      } catch (flotErr: any) {
        await prisma.couponUsage.deleteMany({
          where: { foodOrderId: result.id },
        }).catch(() => null)
        await prisma.foodOrder.delete({ where: { id: result.id } }).catch(() => null)
        return NextResponse.json(
          { success: false, error: `Float payment initiation failed: ${flotErr?.message || "Payment service unavailable"}` },
          { status: 502 }
        )
      }
    }

    // ── Send Email Notifications (Only for COD here; for online prepaid (AfriMoney & Float), sent upon payment confirmation)
    if (requestedPaymentMethod === "COD") {
      try {
        const fullFoodOrder = await prisma.foodOrder.findUnique({
          where: { id: result.id },
          include: {
            customer: { select: { email: true, name: true, phone: true, phoneCountryCode: true } },
            restaurantSeller: {
              include: {
                user: { select: { email: true, name: true, phone: true, phoneCountryCode: true } },
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
            toPhone: fullFoodOrder.customer.phone,
            phoneCountryCode: fullFoodOrder.customer.phoneCountryCode,
            name: fullFoodOrder.customer.name ?? "Customer",
            orderNumber: fullFoodOrder.orderNumber,
            items: emailItems,
            totalAmount: fullFoodOrder.totalAmount,
            deliveryAddress,
            paymentMethod: requestedPaymentMethod
          })

          if (fullFoodOrder.restaurantSeller?.user?.email || fullFoodOrder.restaurantSeller?.user?.phone) {
            await sendRestaurantNewOrderEmail({
              to: fullFoodOrder.restaurantSeller.user?.email,
              toPhone: fullFoodOrder.restaurantSeller.user?.phone,
              phoneCountryCode: fullFoodOrder.restaurantSeller.user?.phoneCountryCode,
              restaurantName: fullFoodOrder.restaurantSeller.businessInfo?.businessName ?? fullFoodOrder.restaurantSeller.user?.name ?? "Restaurant",
              orderNumber: fullFoodOrder.orderNumber,
              items: emailItems.map(i => ({ name: i.name, quantity: i.quantity })),
              customerName: fullFoodOrder.customer.name ?? "Customer",
              deliveryAddress,
              deliveryPhone: fullFoodOrder.deliveryPhone
            })
          }

          const admins = await prisma.user.findMany({
            where: { role: "ADMIN" },
            select: { email: true, phone: true, phoneCountryCode: true }
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
              toPhone: admin.phone,
              phoneCountryCode: admin.phoneCountryCode,
              orderNumber: fullFoodOrder.orderNumber,
              customerName: fullFoodOrder.customer.name ?? "Customer",
              items: adminItems,
              totalAmount: fullFoodOrder.totalAmount,
              commissionAmount: fullFoodOrder.commissionAmount || 0
            })
          }
        }
      } catch (emailErr) {
        console.error("Failed to send food order placement emails:", emailErr)
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
      paymentMethod: requestedPaymentMethod,
      ussdPromptSent,
      afriTxnId,
      flotPaymentLink,
      flotOrderId,
      message: pushMessage
    }, { status: 201 })
  } catch (error: any) {
    console.error("Web place food order error:", error)
    return NextResponse.json({ success: false, error: error.message || "Internal server error" }, { status: 500 })
  }
}
