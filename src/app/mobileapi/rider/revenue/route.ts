import { NextRequest, NextResponse } from "next/server"
import { getMobileRiderAuth } from "../../_helpers/rider-auth"
import { prisma } from "@/lib/prisma"

// GET /mobileapi/rider/revenue — Fetch comprehensive rider revenue & earnings
export async function GET(request: NextRequest) {
  const authResult = await getMobileRiderAuth(request)
  if (!authResult.ok) {
    if (authResult.error === "forbidden") {
      return NextResponse.json({ success: false, error: "Access denied. Riders only." }, { status: 403 })
    }
    if (authResult.error === "suspended") {
      return NextResponse.json({ success: false, error: "Rider account is suspended." }, { status: 403 })
    }
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const statusParam = (searchParams.get("status") || "all").toLowerCase() // all, delivered, inprogress
    const periodParam = (searchParams.get("period") || "all").toLowerCase() // all, today, week, month
    const searchQuery = (searchParams.get("search") || "").trim().toLowerCase()

    // Build Date Filter based on period
    let dateFilter: any = undefined
    const now = new Date()
    if (periodParam === "today") {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      dateFilter = { gte: startOfDay }
    } else if (periodParam === "week") {
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - 7)
      dateFilter = { gte: startOfWeek }
    } else if (periodParam === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      dateFilter = { gte: startOfMonth }
    }

    // Build Status Filter
    let statusFilter: any = undefined
    if (statusParam === "delivered") {
      statusFilter = { in: ["DELIVERED"] }
    } else if (statusParam === "inprogress") {
      statusFilter = { in: ["ACCEPTED", "AT_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY"] }
    } else {
      statusFilter = { in: ["DELIVERED", "ACCEPTED", "AT_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY"] }
    }

    const whereClause: any = {
      riderId: authResult.rider.id,
      status: statusFilter,
    }

    if (dateFilter) {
      if (statusParam === "delivered") {
        whereClause.deliveredAt = dateFilter
      } else if (statusParam === "inprogress") {
        whereClause.offeredAt = dateFilter
      } else {
        whereClause.OR = [
          { deliveredAt: dateFilter },
          { offeredAt: dateFilter },
        ]
      }
    }

    const assignments = await prisma.riderDeliveryAssignment.findMany({
      where: whereClause,
      include: {
        seller: {
          include: {
            store: true,
            businessInfo: true,
            user: { select: { name: true, phone: true } },
          },
        },
        order: {
          include: {
            seller: {
              include: {
                store: true,
                businessInfo: true,
                user: { select: { name: true, phone: true } },
              },
            },
            customer: {
              select: {
                id: true,
                name: true,
                phone: true,
                phoneCountryCode: true,
                image: true,
              },
            },
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    images: true,
                  },
                },
                productVariant: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { offeredAt: "desc" },
    })

    // Filter by search query if present
    const filteredAssignments = assignments.filter((a) => {
      if (!searchQuery) return true
      const orderNumber = a.order?.orderNumber?.toLowerCase() || ""
      const customerName = (a.order?.shippingFullName || a.order?.customer?.name || "").toLowerCase()
      const storeName = (
        a.seller?.store?.name ||
        a.seller?.businessInfo?.businessName ||
        a.order?.seller?.store?.name ||
        ""
      ).toLowerCase()
      return (
        orderNumber.includes(searchQuery) ||
        customerName.includes(searchQuery) ||
        storeName.includes(searchQuery)
      )
    })

    // Map deliveries
    const deliveries = filteredAssignments.map((a) => {
      const assignedSeller = a.seller || a.order?.seller || null
      const assignedItems = (a.order?.items || []).filter(
        (item) => (a.orderItemId ? item.id === a.orderItemId : !a.sellerId || item.sellerId === a.sellerId)
      )

      const itemsShippingSum = assignedItems.reduce(
        (sum, item) => sum + (Number((item as any).shippingAmount) || 0),
        0
      )
      const deliveryCharge = itemsShippingSum > 0 ? itemsShippingSum : Number(a.order?.shipping || 0)

      const isDelivered = a.status === "DELIVERED"
      const statusCategory = isDelivered ? "DELIVERED" : "IN_PROGRESS"

      // Total Amount is realized and returned ONLY for delivered orders
      const totalAmount = isDelivered ? deliveryCharge : null

      const itemsList = assignedItems.map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.productNameSnapshot || item.product?.name || "Product Item",
        variantName: item.productVariant?.name || null,
        quantity: item.quantity,
        price: item.price,
        shippingAmount: Number(item.shippingAmount || 0),
        image: Array.isArray(item.product?.images) ? item.product.images[0] : null,
      }))

      return {
        id: a.id,
        assignmentId: a.id,
        orderId: a.orderId,
        orderNumber: a.order?.orderNumber || a.orderId.slice(-8),
        status: a.status,
        statusCategory, // "DELIVERED" | "IN_PROGRESS"
        isDelivered,
        paymentMethod: a.order?.paymentMethod || "COD",
        settlementStatus: a.settlementStatus || (isDelivered ? ((a.order?.paymentMethod === "AFRIMONEY" || a.order?.paymentMethod === "FLOAT") ? "YET_TO_PAY" : "COD_COLLECTED_BY_RIDER") : "PENDING"),
        codAmountCollected: a.codAmountCollected || null,
        payoutDisbursedAt: a.payoutDisbursedAt || null,
        payoutReference: a.payoutReference || null,
        payoutMethod: a.payoutMethod || null,
        offeredAt: a.offeredAt,
        acceptedAt: a.acceptedAt,
        pickedUpAt: a.pickedUpAt,
        deliveredAt: a.deliveredAt,
        deliveryOtp: isDelivered ? a.deliveryOtp : null,
        deliveryProofImage: a.deliveryProofImage || null,
        distanceKm: a.distanceKm,
        deliveryCharge,
        totalAmount, // Realized earnings (null if in-progress)
        store: {
          id: assignedSeller?.id || null,
          name:
            assignedSeller?.store?.name ||
            assignedSeller?.businessInfo?.businessName ||
            "Seller Store",
          phone: assignedSeller?.user?.phone || null,
          address: [
            assignedSeller?.store?.address || assignedSeller?.businessInfo?.street,
            assignedSeller?.store?.city || assignedSeller?.businessInfo?.city,
          ]
            .filter(Boolean)
            .join(", "),
        },
        customer: {
          id: a.order?.customer?.id || null,
          name: a.order?.shippingFullName || a.order?.customer?.name || "Customer",
          phone: a.order?.shippingPhone || a.order?.customer?.phone || null,
          dropAddress: [
            a.order?.shippingAddressLine1,
            a.order?.shippingCity,
          ]
            .filter(Boolean)
            .join(", "),
        },
        items: itemsList,
        totalItemsCount: itemsList.reduce((acc, it) => acc + it.quantity, 0),
      }
    })

    // Compute Overall Rider Lifetime KPI Stats
    const allRiderAssignments = await prisma.riderDeliveryAssignment.findMany({
      where: { riderId: authResult.rider.id },
      include: {
        order: {
          select: {
            paymentMethod: true,
            shipping: true,
            items: {
              select: { id: true, sellerId: true, shippingAmount: true, subtotal: true, subtotalInclGst: true },
            },
          },
        },
      },
    })

    let totalDeliveredRevenue = 0
    let deliveredCount = 0
    let pendingInProgressRevenue = 0
    let inProgressCount = 0
    let prepaidDeliveredRevenue = 0
    let codDeliveredRevenue = 0
    let codCashCollectedTotal = 0

    allRiderAssignments.forEach((a) => {
      const assignedItems = (a.order?.items || []).filter(
        (item) => (a.orderItemId ? item.id === a.orderItemId : !a.sellerId || item.sellerId === a.sellerId)
      )
      const itemsShippingSum = assignedItems.reduce(
        (sum, item) => sum + (Number(item.shippingAmount) || 0),
        0
      )
      const fee = itemsShippingSum > 0 ? itemsShippingSum : Number(a.order?.shipping || 0)
      const isPrepaid = a.order?.paymentMethod === "AFRIMONEY" || a.order?.paymentMethod === "FLOAT"

      if (a.status === "DELIVERED") {
        totalDeliveredRevenue += fee
        deliveredCount += 1
        if (isPrepaid) {
          prepaidDeliveredRevenue += fee
        } else {
          codDeliveredRevenue += fee
          const itemsSubtotalSum = assignedItems.reduce(
            (s, it) => s + (Number(it.subtotalInclGst || it.subtotal) || 0),
            0
          )
          codCashCollectedTotal += Number(a.codAmountCollected || (itemsSubtotalSum + fee))
        }
      } else if (["ACCEPTED", "AT_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY"].includes(a.status)) {
        pendingInProgressRevenue += fee
        inProgressCount += 1
      }
    })

    const [pendingPayoutRequest, freshRider] = await Promise.all([
      prisma.sellerPayoutRequest.findFirst({
        where: { sellerSector: "RIDER", sellerId: authResult.rider.id, status: "PENDING" },
      }),
      prisma.rider.findUnique({
        where: { id: authResult.rider.id },
        select: {
          netBalance: true,
          paymentOption: true,
          preferredPayoutMethod: true,
          bankName: true,
          accountHolderName: true,
          accountNumber: true,
          mobileNumber: true,
          mobileMoneyOption: true,
        },
      }),
    ])

    const netBalance = Number(freshRider?.netBalance ?? authResult.rider.netBalance ?? 0)

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          netBalance,
          availablePayoutBalance: netBalance,
          totalDeliveredRevenue,
          prepaidDeliveredRevenue,
          codDeliveredRevenue,
          codCashCollectedTotal,
          pendingInProgressRevenue,
          deliveredCount,
          inProgressCount,
          totalDeliveriesCount: deliveredCount + inProgressCount,
          currency: "NLe",
          hasPendingPayoutRequest: Boolean(pendingPayoutRequest),
          pendingPayoutRequest,
        },
        riderBankDetails: {
          paymentOption: freshRider?.paymentOption,
          preferredPayoutMethod: freshRider?.preferredPayoutMethod,
          bankName: freshRider?.bankName,
          accountHolderName: freshRider?.accountHolderName,
          accountNumber: freshRider?.accountNumber,
          mobileNumber: freshRider?.mobileNumber,
          mobileMoneyOption: freshRider?.mobileMoneyOption,
        },
        filters: {
          status: statusParam,
          period: periodParam,
          search: searchQuery,
        },
        count: deliveries.length,
        deliveries,
      },
    })
  } catch (error: any) {
    console.error("[Mobile API] Rider revenue GET error:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load revenue details." },
      { status: 500 }
    )
  }
}
