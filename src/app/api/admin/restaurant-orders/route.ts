import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const { skip, take, page, perPage } = getPaginationFromSearchParams({
    page: searchParams.get("page") ?? undefined,
    perPage: searchParams.get("perPage") ?? "10",
  })

  const restaurantSellerId = searchParams.get("restaurantSellerId")
  const status = searchParams.get("status")
  const q = searchParams.get("q")

  const where: any = {}

  if (restaurantSellerId && restaurantSellerId !== "ALL") {
    where.restaurantSellerId = restaurantSellerId
  }

  if (status && status !== "ALL") {
    where.status = status as any
  }

  if (q) {
    where.OR = [
      { orderNumber: { contains: q, mode: "insensitive" } },
      { deliveryFullName: { contains: q, mode: "insensitive" } },
      { deliveryPhone: { contains: q, mode: "insensitive" } },
      {
        customer: {
          name: { contains: q, mode: "insensitive" }
        }
      }
    ]
  }

  try {
    const isExport = searchParams.get("export") === "true" || searchParams.get("all") === "true"

    const [orders, totalCount] = await Promise.all([
      prisma.foodOrder.findMany({
        where,
        ...(isExport ? {} : { skip, take }),
        include: {
          customer: {
            select: {
              name: true,
              email: true,
              phone: true
            }
          },
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
          },
          items: {
            include: {
              foodItem: {
                select: {
                  name: true,
                  images: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" }
      }),
      prisma.foodOrder.count({ where })
    ])

    const totalPages = Math.ceil(totalCount / perPage) || 1

    const formattedOrders = orders.map(o => {
      const items = o.items.map(item => {
        let imageUrl: string | null = null
        if (Array.isArray(item.foodItem.images) && item.foodItem.images.length > 0) {
          imageUrl = item.foodItem.images[0] as string
        } else if (item.foodItem.images && typeof item.foodItem.images === 'string') {
          try {
            const parsed = JSON.parse(item.foodItem.images)
            if (Array.isArray(parsed) && parsed.length > 0) imageUrl = parsed[0]
          } catch {}
        }
        return {
          id: item.id,
          foodName: item.foodItem.name,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal,
          imageUrl
        }
      })

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        totalAmount: o.totalAmount,
        subtotal: (o as any).subtotal ?? 0,
        deliveryFee: (o as any).deliveryFee ?? 0,
        paymentMethod: (o as any).paymentMethod ?? "COD",
        paymentStatus: (o as any).paymentStatus ?? "PENDING",
        specialInstructions: (o as any).specialInstructions ?? null,
        createdAt: o.createdAt.toISOString(),
        customerName: o.customer.name || (o as any).deliveryFullName || "Customer",
        customerEmail: o.customer.email,
        customerPhone: (o as any).deliveryPhone || o.customer.phone || null,
        deliveryFullName: (o as any).deliveryFullName || o.customer.name || null,
        deliveryPhone: (o as any).deliveryPhone || o.customer.phone || null,
        deliveryAddress: [
          (o as any).deliveryAddressLine1,
          (o as any).deliveryAddressLine2,
          (o as any).deliveryCity,
          (o as any).deliveryState,
          (o as any).deliveryPostalCode
        ].filter(Boolean).join(", "),
        deliveryLandmark: (o as any).deliveryAddressLine2 || null,
        couponCode: (o as any).couponCode || null,
        couponDiscount: (o as any).couponDiscount || null,
        restaurantName: o.restaurantSeller.businessInfo?.businessName || o.restaurantSeller.user.name || "Restaurant",
        restaurantSeller: o.restaurantSeller,
        itemsCount: o.items.length,
        items
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        orders: formattedOrders,
        pagination: {
          totalCount,
          totalPages,
          page,
          perPage
        }
      }
    })
  } catch (error) {
    console.error("Admin get restaurant orders error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
