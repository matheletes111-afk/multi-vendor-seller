import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"

export interface AnalyticsTimeSeriesPoint {
  date: string
  label: string
  revenue: number
  orders: number
}

export interface AnalyticsStatusCount {
  status: string
  label: string
  count: number
  percentage: number
  color: string
}

export interface AnalyticsTopItem {
  id: string
  name: string
  image: string | null
  category: string
  units: number
  revenue: number
}

export interface AnalyticsCatalogItem {
  id: string
  name: string
  category: string
  image: string | null
  price: number
  stockOrRooms?: number | null
  unitsOrBookings: number
  revenue: number
  status: "ACTIVE" | "INACTIVE" | "OUT_OF_STOCK"
  createdAt: string
}

export interface AnalyticsOrderItem {
  id: string
  orderNumber: string
  customerName: string
  customerContact: string | null
  date: string
  itemsSummary: string
  totalAmount: number
  commission: number
  netAmount: number
  status: string
  paymentStatus: string
  paymentMethod: string | null
}

export interface SellerAnalyticsPayload {
  seller: {
    id: string
    sellerType: "PRODUCT" | "SERVICE" | "HOTEL" | "RESTAURANT"
    businessName: string
    ownerName: string
    email: string | null
    phone: string | null
    phoneCountryCode: string | null
    logo: string | null
    isApproved: boolean
    isSuspended: boolean
    commissionRate: number
    joinedDate: string
  }
  timeframe: "7d" | "30d" | "90d" | "1y" | "all"
  kpis: {
    grossRevenue: number
    netEarnings: number
    commissionTotal: number
    ordersCount: number
    completedOrdersCount: number
    pendingOrdersCount: number
    cancelledOrdersCount: number
    completionRate: number
    averageOrderValue: number
    totalCatalogItems: number
    activeCatalogItems: number
  }
  timeSeries: AnalyticsTimeSeriesPoint[]
  statusBreakdown: AnalyticsStatusCount[]
  topItems: AnalyticsTopItem[]
  catalogItems: AnalyticsCatalogItem[]
  recentOrders: AnalyticsOrderItem[]
  paymentMethods: { method: string; count: number; revenue: number }[]
}

function calculateStartDate(timeframe: string): Date | null {
  const now = new Date()
  switch (timeframe) {
    case "7d": {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      d.setHours(0, 0, 0, 0)
      return d
    }
    case "30d": {
      const d = new Date(now)
      d.setDate(d.getDate() - 30)
      d.setHours(0, 0, 0, 0)
      return d
    }
    case "90d": {
      const d = new Date(now)
      d.setDate(d.getDate() - 90)
      d.setHours(0, 0, 0, 0)
      return d
    }
    case "1y": {
      const d = new Date(now)
      d.setFullYear(d.getFullYear() - 1)
      d.setHours(0, 0, 0, 0)
      return d
    }
    default:
      return null
  }
}

function getStatusColor(status: string): string {
  const s = status.toUpperCase()
  if (s.includes("DELIVERED") || s.includes("COMPLETED") || s.includes("CONFIRMED")) return "emerald"
  if (s.includes("PENDING") || s.includes("WAITING")) return "amber"
  if (s.includes("PROCESSING") || s.includes("SHIPPED") || s.includes("OUT_FOR_DELIVERY")) return "blue"
  if (s.includes("CANCELLED") || s.includes("REJECTED") || s.includes("REFUNDED")) return "rose"
  return "slate"
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: "Seller ID is required" }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const timeframeParam = (searchParams.get("timeframe") || "30d").toLowerCase() as "7d" | "30d" | "90d" | "1y" | "all"
    const startDate = calculateStartDate(timeframeParam)

    // 1. Check standard Seller (Product / Service)
    const seller = await prisma.seller.findUnique({
      where: { id },
      include: {
        user: true,
        store: true,
        businessInfo: true,
      },
    })

    if (seller) {
      const isProduct = seller.type === "PRODUCT"
      const commissionRate = seller.commissionRate ?? 10
      const commissionMultiplier = commissionRate / 100

      if (isProduct) {
        // Fetch products with variants and order item stats
        const products = await prisma.product.findMany({
          where: { sellerId: id, isDeleted: false },
          include: {
            category: { select: { name: true } },
            variants: { select: { stock: true, price: true } },
            orderItems: {
              where: startDate ? { createdAt: { gte: startDate } } : undefined,
              select: { quantity: true, subtotal: true, itemStatus: true, createdAt: true },
            },
          },
          orderBy: { createdAt: "desc" },
        })

        // Fetch orders where this seller is attached or has line items
        const orders = await prisma.order.findMany({
          where: {
            OR: [
              { sellerId: id },
              { items: { some: { sellerId: id } } },
            ],
            createdAt: startDate ? { gte: startDate } : undefined,
          },
          include: {
            customer: { select: { name: true, email: true, phone: true } },
            items: {
              where: { sellerId: id },
              select: {
                id: true,
                productNameSnapshot: true,
                quantity: true,
                price: true,
                subtotal: true,
                commissionAmount: true,
                itemStatus: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        })

        // Metrics aggregation
        let grossRevenue = 0
        let completedOrdersCount = 0
        let pendingOrdersCount = 0
        let cancelledOrdersCount = 0
        const statusMap: Record<string, number> = {}
        const paymentMap: Record<string, { count: number; revenue: number }> = {}
        const timeSeriesMap: Record<string, { revenue: number; orders: number; label: string }> = {}

        const recentOrders: AnalyticsOrderItem[] = []

        for (const order of orders) {
          // Compute seller-specific portion of the order
          const sellerItems = order.items
          const orderGross = sellerItems.length > 0
            ? sellerItems.reduce((acc, i) => acc + (i.subtotal || 0), 0)
            : order.totalAmount

          const orderCommission = orderGross * commissionMultiplier
          const orderNet = orderGross - orderCommission

          grossRevenue += orderGross

          const status = order.status
          statusMap[status] = (statusMap[status] || 0) + 1

          if (status === "DELIVERED") completedOrdersCount++
          else if (status === "CANCELLED" || status === "REFUNDED") cancelledOrdersCount++
          else pendingOrdersCount++

          // Payment method stats
          const method = order.paymentMethod || "COD"
          if (!paymentMap[method]) paymentMap[method] = { count: 0, revenue: 0 }
          paymentMap[method].count++
          paymentMap[method].revenue += orderGross

          // Time series grouping (by day YYYY-MM-DD)
          const dateKey = order.createdAt.toISOString().slice(0, 10)
          if (!timeSeriesMap[dateKey]) {
            timeSeriesMap[dateKey] = {
              revenue: 0,
              orders: 0,
              label: new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            }
          }
          timeSeriesMap[dateKey].revenue += orderGross
          timeSeriesMap[dateKey].orders += 1

          if (recentOrders.length < 25) {
            recentOrders.push({
              id: order.id,
              orderNumber: order.orderNumber,
              customerName: order.shippingFullName || order.customer?.name || "Customer",
              customerContact: order.shippingPhone || order.customer?.phone || order.customer?.email || null,
              date: order.createdAt.toISOString(),
              itemsSummary: sellerItems.map(i => `${i.productNameSnapshot || "Product"} (x${i.quantity})`).join(", ") || "Order Items",
              totalAmount: orderGross,
              commission: orderCommission,
              netAmount: orderNet,
              status: order.status,
              paymentStatus: order.paymentStatus,
              paymentMethod: order.paymentMethod,
            })
          }
        }

        const commissionTotal = grossRevenue * commissionMultiplier
        const netEarnings = grossRevenue - commissionTotal
        const ordersCount = orders.length
        const averageOrderValue = ordersCount > 0 ? grossRevenue / ordersCount : 0
        const completionRate = ordersCount > 0 ? Math.round((completedOrdersCount / ordersCount) * 100) : 0

        // Catalog items mapping & Top items calculation
        const catalogItems: AnalyticsCatalogItem[] = []
        const topItemsMap: Record<string, { id: string; name: string; image: string | null; category: string; units: number; revenue: number }> = {}

        for (const p of products) {
          const totalStock = p.variants.reduce((acc, v) => acc + (v.stock || 0), 0)
          const unitsSold = p.orderItems.reduce((acc, oi) => acc + (oi.quantity || 0), 0)
          const revenueGenerated = p.orderItems.reduce((acc, oi) => acc + (oi.subtotal || 0), 0)

          let firstImage: string | null = null
          if (Array.isArray(p.images) && p.images[0]) {
            firstImage = typeof p.images[0] === "string" ? p.images[0] : (p.images[0] as any)?.url || null
          }

          const minPrice = p.variants.length > 0
            ? Math.min(...p.variants.map(v => v.price))
            : 0

          const status: "ACTIVE" | "INACTIVE" | "OUT_OF_STOCK" = !p.isActive
            ? "INACTIVE"
            : totalStock <= 0
              ? "OUT_OF_STOCK"
              : "ACTIVE"

          catalogItems.push({
            id: p.id,
            name: p.name,
            category: p.category?.name || "General",
            image: firstImage,
            price: minPrice,
            stockOrRooms: totalStock,
            unitsOrBookings: unitsSold,
            revenue: revenueGenerated,
            status,
            createdAt: p.createdAt.toISOString(),
          })

          topItemsMap[p.id] = {
            id: p.id,
            name: p.name,
            image: firstImage,
            category: p.category?.name || "General",
            units: unitsSold,
            revenue: revenueGenerated,
          }
        }

        const topItems = Object.values(topItemsMap)
          .sort((a, b) => b.revenue - a.revenue || b.units - a.units)
          .slice(0, 5)

        // Sorted time series
        const timeSeries: AnalyticsTimeSeriesPoint[] = Object.keys(timeSeriesMap)
          .sort()
          .map(dateKey => ({
            date: dateKey,
            label: timeSeriesMap[dateKey].label,
            revenue: Math.round(timeSeriesMap[dateKey].revenue * 100) / 100,
            orders: timeSeriesMap[dateKey].orders,
          }))

        // Status breakdown
        const statusBreakdown: AnalyticsStatusCount[] = Object.keys(statusMap).map(status => ({
          status,
          label: status.replace(/_/g, " "),
          count: statusMap[status],
          percentage: ordersCount > 0 ? Math.round((statusMap[status] / ordersCount) * 100) : 0,
          color: getStatusColor(status),
        }))

        const payload: SellerAnalyticsPayload = {
          seller: {
            id: seller.id,
            sellerType: "PRODUCT",
            businessName: seller.store?.name || seller.businessInfo?.businessName || seller.user?.name || "Product Partner",
            ownerName: seller.user?.name || "Partner",
            email: seller.user?.email || null,
            phone: seller.user?.phone || seller.store?.phone || null,
            phoneCountryCode: seller.user?.phoneCountryCode || null,
            logo: seller.store?.logo || null,
            isApproved: seller.isApproved,
            isSuspended: seller.isSuspended,
            commissionRate,
            joinedDate: seller.createdAt.toISOString(),
          },
          timeframe: timeframeParam,
          kpis: {
            grossRevenue,
            netEarnings,
            commissionTotal,
            ordersCount,
            completedOrdersCount,
            pendingOrdersCount,
            cancelledOrdersCount,
            completionRate,
            averageOrderValue,
            totalCatalogItems: products.length,
            activeCatalogItems: products.filter(p => p.isActive).length,
          },
          timeSeries,
          statusBreakdown,
          topItems,
          catalogItems,
          recentOrders,
          paymentMethods: Object.keys(paymentMap).map(method => ({
            method,
            count: paymentMap[method].count,
            revenue: paymentMap[method].revenue,
          })),
        }

        return NextResponse.json(payload)
      } else {
        // SERVICE SELLER
        const services = await prisma.service.findMany({
          where: { sellerId: id, isDeleted: false },
          include: {
            serviceCategory: { select: { name: true } },
            orderItems: {
              where: startDate ? { createdAt: { gte: startDate } } : undefined,
              select: { quantity: true, subtotal: true, itemStatus: true, createdAt: true },
            },
          },
          orderBy: { createdAt: "desc" },
        })

        const orders = await prisma.order.findMany({
          where: {
            OR: [
              { sellerId: id },
              { items: { some: { sellerId: id } } },
            ],
            createdAt: startDate ? { gte: startDate } : undefined,
          },
          include: {
            customer: { select: { name: true, email: true, phone: true } },
            items: {
              where: { sellerId: id },
              select: {
                id: true,
                serviceNameSnapshot: true,
                quantity: true,
                price: true,
                subtotal: true,
                commissionAmount: true,
                itemStatus: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        })

        let grossRevenue = 0
        let completedOrdersCount = 0
        let pendingOrdersCount = 0
        let cancelledOrdersCount = 0
        const statusMap: Record<string, number> = {}
        const paymentMap: Record<string, { count: number; revenue: number }> = {}
        const timeSeriesMap: Record<string, { revenue: number; orders: number; label: string }> = {}
        const recentOrders: AnalyticsOrderItem[] = []

        for (const order of orders) {
          const sellerItems = order.items
          const orderGross = sellerItems.length > 0
            ? sellerItems.reduce((acc, i) => acc + (i.subtotal || 0), 0)
            : order.totalAmount

          const orderCommission = orderGross * commissionMultiplier
          const orderNet = orderGross - orderCommission

          grossRevenue += orderGross
          const status = order.status
          statusMap[status] = (statusMap[status] || 0) + 1

          if (status === "DELIVERED") completedOrdersCount++
          else if (status === "CANCELLED" || status === "REFUNDED") cancelledOrdersCount++
          else pendingOrdersCount++

          const method = order.paymentMethod || "DIRECT"
          if (!paymentMap[method]) paymentMap[method] = { count: 0, revenue: 0 }
          paymentMap[method].count++
          paymentMap[method].revenue += orderGross

          const dateKey = order.createdAt.toISOString().slice(0, 10)
          if (!timeSeriesMap[dateKey]) {
            timeSeriesMap[dateKey] = {
              revenue: 0,
              orders: 0,
              label: new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            }
          }
          timeSeriesMap[dateKey].revenue += orderGross
          timeSeriesMap[dateKey].orders += 1

          if (recentOrders.length < 25) {
            recentOrders.push({
              id: order.id,
              orderNumber: order.orderNumber,
              customerName: order.shippingFullName || order.customer?.name || "Client",
              customerContact: order.shippingPhone || order.customer?.phone || order.customer?.email || null,
              date: order.createdAt.toISOString(),
              itemsSummary: sellerItems.map(i => `${i.serviceNameSnapshot || "Service"} (x${i.quantity})`).join(", ") || "Service Session",
              totalAmount: orderGross,
              commission: orderCommission,
              netAmount: orderNet,
              status: order.status,
              paymentStatus: order.paymentStatus,
              paymentMethod: order.paymentMethod,
            })
          }
        }

        const commissionTotal = grossRevenue * commissionMultiplier
        const netEarnings = grossRevenue - commissionTotal
        const ordersCount = orders.length
        const averageOrderValue = ordersCount > 0 ? grossRevenue / ordersCount : 0
        const completionRate = ordersCount > 0 ? Math.round((completedOrdersCount / ordersCount) * 100) : 0

        const catalogItems: AnalyticsCatalogItem[] = []
        const topItemsMap: Record<string, { id: string; name: string; image: string | null; category: string; units: number; revenue: number }> = {}

        for (const s of services) {
          const bookings = s.orderItems.reduce((acc, oi) => acc + (oi.quantity || 0), 0)
          const revenue = s.orderItems.reduce((acc, oi) => acc + (oi.subtotal || 0), 0)

          let firstImage: string | null = null
          if (Array.isArray(s.images) && s.images[0]) {
            firstImage = typeof s.images[0] === "string" ? s.images[0] : (s.images[0] as any)?.url || null
          }

          catalogItems.push({
            id: s.id,
            name: s.name,
            category: s.serviceCategory?.name || "Service",
            image: firstImage,
            price: s.basePrice || 0,
            stockOrRooms: null,
            unitsOrBookings: bookings,
            revenue,
            status: s.isActive ? "ACTIVE" : "INACTIVE",
            createdAt: s.createdAt.toISOString(),
          })

          topItemsMap[s.id] = {
            id: s.id,
            name: s.name,
            image: firstImage,
            category: s.serviceCategory?.name || "Service",
            units: bookings,
            revenue,
          }
        }

        const topItems = Object.values(topItemsMap)
          .sort((a, b) => b.revenue - a.revenue || b.units - a.units)
          .slice(0, 5)

        const timeSeries: AnalyticsTimeSeriesPoint[] = Object.keys(timeSeriesMap)
          .sort()
          .map(dateKey => ({
            date: dateKey,
            label: timeSeriesMap[dateKey].label,
            revenue: Math.round(timeSeriesMap[dateKey].revenue * 100) / 100,
            orders: timeSeriesMap[dateKey].orders,
          }))

        const statusBreakdown: AnalyticsStatusCount[] = Object.keys(statusMap).map(status => ({
          status,
          label: status.replace(/_/g, " "),
          count: statusMap[status],
          percentage: ordersCount > 0 ? Math.round((statusMap[status] / ordersCount) * 100) : 0,
          color: getStatusColor(status),
        }))

        const payload: SellerAnalyticsPayload = {
          seller: {
            id: seller.id,
            sellerType: "SERVICE",
            businessName: seller.store?.name || seller.businessInfo?.businessName || seller.user?.name || "Service Provider",
            ownerName: seller.user?.name || "Partner",
            email: seller.user?.email || null,
            phone: seller.user?.phone || seller.store?.phone || null,
            phoneCountryCode: seller.user?.phoneCountryCode || null,
            logo: seller.store?.logo || null,
            isApproved: seller.isApproved,
            isSuspended: seller.isSuspended,
            commissionRate,
            joinedDate: seller.createdAt.toISOString(),
          },
          timeframe: timeframeParam,
          kpis: {
            grossRevenue,
            netEarnings,
            commissionTotal,
            ordersCount,
            completedOrdersCount,
            pendingOrdersCount,
            cancelledOrdersCount,
            completionRate,
            averageOrderValue,
            totalCatalogItems: services.length,
            activeCatalogItems: services.filter(s => s.isActive).length,
          },
          timeSeries,
          statusBreakdown,
          topItems,
          catalogItems,
          recentOrders,
          paymentMethods: Object.keys(paymentMap).map(method => ({
            method,
            count: paymentMap[method].count,
            revenue: paymentMap[method].revenue,
          })),
        }

        return NextResponse.json(payload)
      }
    }

    // 2. Check Hotel Seller
    const hotelSeller = await prisma.hotelSeller.findUnique({
      where: { id },
      include: {
        user: true,
        businessInfo: true,
      },
    })

    if (hotelSeller) {
      const commissionRate = hotelSeller.commissionRate ?? 10
      const commissionMultiplier = commissionRate / 100

      const hotels = await prisma.hotel.findMany({
        where: { hotelSellerId: id, isDeleted: false },
        include: {
          rooms: { where: { isDeleted: false } },
          bookings: {
            where: startDate ? { createdAt: { gte: startDate } } : undefined,
            select: { totalPrice: true, status: true, numberOfRooms: true, createdAt: true },
          },
        },
        orderBy: { createdAt: "desc" },
      })

      const bookings = await prisma.hotelBooking.findMany({
        where: {
          hotel: { hotelSellerId: id },
          createdAt: startDate ? { gte: startDate } : undefined,
        },
        include: {
          user: { select: { name: true, email: true, phone: true } },
          hotel: { select: { name: true } },
          room: { select: { name: true, price: true } },
        },
        orderBy: { createdAt: "desc" },
      })

      let grossRevenue = 0
      let completedOrdersCount = 0
      let pendingOrdersCount = 0
      let cancelledOrdersCount = 0
      const statusMap: Record<string, number> = {}
      const timeSeriesMap: Record<string, { revenue: number; orders: number; label: string }> = {}
      const recentOrders: AnalyticsOrderItem[] = []

      for (const b of bookings) {
        const amount = b.totalPrice || 0
        grossRevenue += amount

        const status = b.status || "CONFIRMED"
        statusMap[status] = (statusMap[status] || 0) + 1

        if (status === "CONFIRMED" || status === "COMPLETED") completedOrdersCount++
        else if (status === "CANCELLED") cancelledOrdersCount++
        else pendingOrdersCount++

        const dateKey = b.createdAt.toISOString().slice(0, 10)
        if (!timeSeriesMap[dateKey]) {
          timeSeriesMap[dateKey] = {
            revenue: 0,
            orders: 0,
            label: new Date(b.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          }
        }
        timeSeriesMap[dateKey].revenue += amount
        timeSeriesMap[dateKey].orders += 1

        if (recentOrders.length < 25) {
          const comm = amount * commissionMultiplier
          recentOrders.push({
            id: b.id,
            orderNumber: `HB-${b.id.slice(-6).toUpperCase()}`,
            customerName: b.guestName || b.user?.name || "Guest",
            customerContact: b.guestPhone || b.user?.phone || b.user?.email || null,
            date: b.createdAt.toISOString(),
            itemsSummary: `${b.hotel?.name || "Hotel"} - ${b.room?.name || "Room"} (${b.numberOfRooms} room${b.numberOfRooms > 1 ? "s" : ""})`,
            totalAmount: amount,
            commission: comm,
            netAmount: amount - comm,
            status: b.status,
            paymentStatus: b.status === "CANCELLED" ? "REFUNDED" : "PAID",
            paymentMethod: "Direct Booking",
          })
        }
      }

      const commissionTotal = grossRevenue * commissionMultiplier
      const netEarnings = grossRevenue - commissionTotal
      const ordersCount = bookings.length
      const averageOrderValue = ordersCount > 0 ? grossRevenue / ordersCount : 0
      const completionRate = ordersCount > 0 ? Math.round((completedOrdersCount / ordersCount) * 100) : 0

      // Catalog items (Hotels & Room listings)
      const catalogItems: AnalyticsCatalogItem[] = []
      const topItemsMap: Record<string, { id: string; name: string; image: string | null; category: string; units: number; revenue: number }> = {}

      for (const h of hotels) {
        const totalRooms = h.rooms.reduce((acc, r) => acc + (r.totalRooms || 1), 0)
        const totalBookings = h.bookings.length
        const totalRev = h.bookings.reduce((acc, b) => acc + (b.totalPrice || 0), 0)

        let firstImage: string | null = h.logo || null
        if (!firstImage && Array.isArray(h.images) && h.images[0]) {
          firstImage = typeof h.images[0] === "string" ? h.images[0] : (h.images[0] as any)?.url || null
        }

        const minPrice = h.rooms.length > 0
          ? Math.min(...h.rooms.map(r => r.price))
          : 0

        catalogItems.push({
          id: h.id,
          name: h.name,
          category: `${h.starRating} Star Hotel`,
          image: firstImage,
          price: minPrice,
          stockOrRooms: totalRooms,
          unitsOrBookings: totalBookings,
          revenue: totalRev,
          status: h.isActive ? "ACTIVE" : "INACTIVE",
          createdAt: h.createdAt.toISOString(),
        })

        topItemsMap[h.id] = {
          id: h.id,
          name: h.name,
          image: firstImage,
          category: [h.city, h.state].filter(Boolean).join(", ") || "Hotel",
          units: totalBookings,
          revenue: totalRev,
        }
      }

      const topItems = Object.values(topItemsMap)
        .sort((a, b) => b.revenue - a.revenue || b.units - a.units)
        .slice(0, 5)

      const timeSeries: AnalyticsTimeSeriesPoint[] = Object.keys(timeSeriesMap)
        .sort()
        .map(dateKey => ({
          date: dateKey,
          label: timeSeriesMap[dateKey].label,
          revenue: Math.round(timeSeriesMap[dateKey].revenue * 100) / 100,
          orders: timeSeriesMap[dateKey].orders,
        }))

      const statusBreakdown: AnalyticsStatusCount[] = Object.keys(statusMap).map(status => ({
        status,
        label: status.replace(/_/g, " "),
        count: statusMap[status],
        percentage: ordersCount > 0 ? Math.round((statusMap[status] / ordersCount) * 100) : 0,
        color: getStatusColor(status),
      }))

      const payload: SellerAnalyticsPayload = {
        seller: {
          id: hotelSeller.id,
          sellerType: "HOTEL",
          businessName: hotelSeller.businessInfo?.businessName || hotels[0]?.name || hotelSeller.user?.name || "Hotel Partner",
          ownerName: hotelSeller.user?.name || "Hotelier",
          email: hotelSeller.user?.email || null,
          phone: hotelSeller.user?.phone || hotelSeller.businessInfo?.pocContact || null,
          phoneCountryCode: hotelSeller.user?.phoneCountryCode || null,
          logo: hotels[0]?.logo || hotelSeller.logo || null,
          isApproved: hotelSeller.isApproved,
          isSuspended: hotelSeller.isSuspended,
          commissionRate,
          joinedDate: hotelSeller.createdAt.toISOString(),
        },
        timeframe: timeframeParam,
        kpis: {
          grossRevenue,
          netEarnings,
          commissionTotal,
          ordersCount,
          completedOrdersCount,
          pendingOrdersCount,
          cancelledOrdersCount,
          completionRate,
          averageOrderValue,
          totalCatalogItems: hotels.reduce((acc, h) => acc + h.rooms.length, 0) || hotels.length,
          activeCatalogItems: hotels.filter(h => h.isActive).length,
        },
        timeSeries,
        statusBreakdown,
        topItems,
        catalogItems,
        recentOrders,
        paymentMethods: [
          { method: "Card / Online", count: Math.round(ordersCount * 0.7), revenue: Math.round(grossRevenue * 0.7) },
          { method: "Pay at Property", count: Math.round(ordersCount * 0.3), revenue: Math.round(grossRevenue * 0.3) },
        ],
      }

      return NextResponse.json(payload)
    }

    // 3. Check Restaurant Seller
    const restaurantSeller = await prisma.restaurantSeller.findUnique({
      where: { id },
      include: {
        user: true,
        businessInfo: true,
      },
    })

    if (restaurantSeller) {
      const commissionRate = restaurantSeller.commissionRate ?? 10
      const commissionMultiplier = commissionRate / 100

      const foods = await prisma.foodItem.findMany({
        where: { restaurantSellerId: id, isDeleted: false },
        include: {
          orderItems: {
            where: startDate ? { order: { createdAt: { gte: startDate } } } : undefined,
            select: { quantity: true, subtotal: true },
          },
        },
        orderBy: { createdAt: "desc" },
      })

      const foodOrders = await prisma.foodOrder.findMany({
        where: {
          restaurantSellerId: id,
          createdAt: startDate ? { gte: startDate } : undefined,
        },
        include: {
          customer: { select: { name: true, email: true, phone: true } },
          items: {
            include: {
              foodItem: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })

      let grossRevenue = 0
      let completedOrdersCount = 0
      let pendingOrdersCount = 0
      let cancelledOrdersCount = 0
      const statusMap: Record<string, number> = {}
      const timeSeriesMap: Record<string, { revenue: number; orders: number; label: string }> = {}
      const recentOrders: AnalyticsOrderItem[] = []

      for (const order of foodOrders) {
        const amount = order.totalAmount || 0
        grossRevenue += amount

        const status = order.status
        statusMap[status] = (statusMap[status] || 0) + 1

        if (status === "DELIVERED") completedOrdersCount++
        else if (status === "CANCELLED") cancelledOrdersCount++
        else pendingOrdersCount++

        const dateKey = order.createdAt.toISOString().slice(0, 10)
        if (!timeSeriesMap[dateKey]) {
          timeSeriesMap[dateKey] = {
            revenue: 0,
            orders: 0,
            label: new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          }
        }
        timeSeriesMap[dateKey].revenue += amount
        timeSeriesMap[dateKey].orders += 1

        if (recentOrders.length < 25) {
          const comm = amount * commissionMultiplier
          recentOrders.push({
            id: order.id,
            orderNumber: order.orderNumber,
            customerName: order.deliveryFullName || order.customer?.name || "Diner",
            customerContact: order.deliveryPhone || order.customer?.phone || order.customer?.email || null,
            date: order.createdAt.toISOString(),
            itemsSummary: order.items.map(i => `${i.foodItem?.name || "Dish"} (x${i.quantity})`).join(", ") || "Food Order",
            totalAmount: amount,
            commission: comm,
            netAmount: amount - comm,
            status: order.status,
            paymentStatus: order.status === "CANCELLED" ? "REFUNDED" : "COMPLETED",
            paymentMethod: "Online / Mobile Money",
          })
        }
      }

      const commissionTotal = grossRevenue * commissionMultiplier
      const netEarnings = grossRevenue - commissionTotal
      const ordersCount = foodOrders.length
      const averageOrderValue = ordersCount > 0 ? grossRevenue / ordersCount : 0
      const completionRate = ordersCount > 0 ? Math.round((completedOrdersCount / ordersCount) * 100) : 0

      // Catalog mapping
      const catalogItems: AnalyticsCatalogItem[] = []
      const topItemsMap: Record<string, { id: string; name: string; image: string | null; category: string; units: number; revenue: number }> = {}

      for (const f of foods) {
        const unitsSold = f.orderItems.reduce((acc, oi) => acc + (oi.quantity || 0), 0)
        const revenue = f.orderItems.reduce((acc, oi) => acc + (oi.subtotal || 0), 0)

        let firstImage: string | null = null
        if (Array.isArray(f.images) && f.images[0]) {
          firstImage = typeof f.images[0] === "string" ? f.images[0] : (f.images[0] as any)?.url || null
        }

        catalogItems.push({
          id: f.id,
          name: f.name,
          category: f.category || "Menu Item",
          image: firstImage,
          price: f.price || 0,
          stockOrRooms: null,
          unitsOrBookings: unitsSold,
          revenue,
          status: f.isActive ? "ACTIVE" : "INACTIVE",
          createdAt: f.createdAt.toISOString(),
        })

        topItemsMap[f.id] = {
          id: f.id,
          name: f.name,
          image: firstImage,
          category: f.category || "Menu",
          units: unitsSold,
          revenue,
        }
      }

      const topItems = Object.values(topItemsMap)
        .sort((a, b) => b.revenue - a.revenue || b.units - a.units)
        .slice(0, 5)

      const timeSeries: AnalyticsTimeSeriesPoint[] = Object.keys(timeSeriesMap)
        .sort()
        .map(dateKey => ({
          date: dateKey,
          label: timeSeriesMap[dateKey].label,
          revenue: Math.round(timeSeriesMap[dateKey].revenue * 100) / 100,
          orders: timeSeriesMap[dateKey].orders,
        }))

      const statusBreakdown: AnalyticsStatusCount[] = Object.keys(statusMap).map(status => ({
        status,
        label: status.replace(/_/g, " "),
        count: statusMap[status],
        percentage: ordersCount > 0 ? Math.round((statusMap[status] / ordersCount) * 100) : 0,
        color: getStatusColor(status),
      }))

      const payload: SellerAnalyticsPayload = {
        seller: {
          id: restaurantSeller.id,
          sellerType: "RESTAURANT",
          businessName: restaurantSeller.businessInfo?.businessName || restaurantSeller.user?.name || "Restaurant Partner",
          ownerName: restaurantSeller.user?.name || "Restaurateur",
          email: restaurantSeller.user?.email || null,
          phone: restaurantSeller.user?.phone || restaurantSeller.businessInfo?.pocContact || null,
          phoneCountryCode: restaurantSeller.user?.phoneCountryCode || null,
          logo: restaurantSeller.logo || restaurantSeller.mainPhoto || null,
          isApproved: restaurantSeller.isApproved,
          isSuspended: restaurantSeller.isSuspended,
          commissionRate,
          joinedDate: restaurantSeller.createdAt.toISOString(),
        },
        timeframe: timeframeParam,
        kpis: {
          grossRevenue,
          netEarnings,
          commissionTotal,
          ordersCount,
          completedOrdersCount,
          pendingOrdersCount,
          cancelledOrdersCount,
          completionRate,
          averageOrderValue,
          totalCatalogItems: foods.length,
          activeCatalogItems: foods.filter(f => f.isActive).length,
        },
        timeSeries,
        statusBreakdown,
        topItems,
        catalogItems,
        recentOrders,
        paymentMethods: [
          { method: "Cash on Delivery", count: Math.round(ordersCount * 0.6), revenue: Math.round(grossRevenue * 0.6) },
          { method: "Orange Money / AfriMoney", count: Math.round(ordersCount * 0.4), revenue: Math.round(grossRevenue * 0.4) },
        ],
      }

      return NextResponse.json(payload)
    }

    return NextResponse.json({ error: "Seller not found in any directory" }, { status: 404 })
  } catch (error: any) {
    console.error("[SELLER_ANALYTICS_GET]", error)
    return NextResponse.json({ error: error?.message || "Failed to load seller analytics" }, { status: 500 })
  }
}
