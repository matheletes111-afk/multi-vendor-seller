import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"

function formatAccountSnapshot(bank: any): string {
  if (!bank) return "No bank or mobile money details on file"
  const parts: string[] = []
  if (bank.paymentOption) parts.push(`Method: ${bank.paymentOption}`)
  if (bank.bankName) parts.push(`Bank: ${bank.bankName}`)
  if (bank.accountHolderName) parts.push(`Holder: ${bank.accountHolderName}`)
  if (bank.accountNumber) parts.push(`Acc: ${bank.accountNumber}`)
  if (bank.mobileNumber) parts.push(`Mobile: ${bank.mobileNumber}`)
  if (bank.mobileMoneyOption) parts.push(`Wallet: ${bank.mobileMoneyOption}`)
  return parts.join(" • ") || "No bank details on file"
}

export async function GET(_request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 1. Fetch all pending payout requests
    const pendingRequestsRaw = await prisma.sellerPayoutRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { requestedAt: "desc" },
    })

    // 2. Fetch all disbursed payout requests (history) & aggregates
    const [disbursedHistoryRaw, disbursedAgg, totalDisbursedCount] = await Promise.all([
      prisma.sellerPayoutRequest.findMany({
        where: { status: "DISBURSED" },
        orderBy: { disbursedAt: "desc" },
        take: 50,
      }),
      prisma.sellerPayoutRequest.aggregate({
        where: { status: "DISBURSED" },
        _sum: { requestedAmount: true },
      }),
      prisma.sellerPayoutRequest.count({
        where: { status: "DISBURSED" },
      }),
    ])

    // 3. Fetch all sellers with netBalance > 0 across all sectors (including Riders)
    const [productSellers, hotelSellers, restaurantSellers, riders] = await Promise.all([
      prisma.seller.findMany({
        where: { netBalance: { gt: 0 } },
        include: {
          store: { select: { name: true, phone: true } },
          user: { select: { name: true, email: true, phone: true, phoneCountryCode: true } },
          bankDetails: true,
        },
        orderBy: { netBalance: "desc" },
      }),
      prisma.hotelSeller.findMany({
        where: { netBalance: { gt: 0 } },
        include: {
          hotels: { select: { name: true, city: true }, take: 1 },
          businessInfo: { select: { businessName: true, pocContact: true } },
          user: { select: { name: true, email: true, phone: true, phoneCountryCode: true } },
          bankDetails: true,
        },
        orderBy: { netBalance: "desc" },
      }),
      prisma.restaurantSeller.findMany({
        where: { netBalance: { gt: 0 } },
        include: {
          businessInfo: { select: { businessName: true, pocContact: true } },
          user: { select: { name: true, email: true, phone: true, phoneCountryCode: true } },
          bankDetails: true,
        },
        orderBy: { netBalance: "desc" },
      }),
      prisma.rider.findMany({
        where: { netBalance: { gt: 0 } },
        include: {
          user: { select: { name: true, email: true, phone: true, phoneCountryCode: true } },
        },
        orderBy: { netBalance: "desc" },
      }),
    ])

    // Helper map to enrich seller details for payout requests
    const allSellerIds = Array.from(
      new Set([
        ...pendingRequestsRaw.map((r) => r.sellerId),
        ...disbursedHistoryRaw.map((r) => r.sellerId),
      ])
    )

    const [sellersForRequests, hotelSellersForRequests, restaurantSellersForRequests, ridersForRequests] =
      await Promise.all([
        prisma.seller.findMany({
          where: { id: { in: allSellerIds } },
          include: {
            store: { select: { name: true } },
            user: { select: { name: true, email: true, phone: true } },
            bankDetails: true,
          },
        }),
        prisma.hotelSeller.findMany({
          where: { id: { in: allSellerIds } },
          include: {
            hotels: { select: { name: true }, take: 1 },
            businessInfo: { select: { businessName: true } },
            user: { select: { name: true, email: true, phone: true } },
            bankDetails: true,
          },
        }),
        prisma.restaurantSeller.findMany({
          where: { id: { in: allSellerIds } },
          include: {
            businessInfo: { select: { businessName: true } },
            user: { select: { name: true, email: true, phone: true } },
            bankDetails: true,
          },
        }),
        prisma.rider.findMany({
          where: { id: { in: allSellerIds } },
          include: {
            user: { select: { name: true, email: true, phone: true } },
          },
        }),
      ])

    const sellerMap = new Map<string, any>()
    sellersForRequests.forEach((s) => sellerMap.set(s.id, {
      storeName: s.store?.name || s.user.name || "Product Seller",
      ownerName: s.user.name,
      email: s.user.email,
      phone: s.user.phone,
      bankDetails: s.bankDetails,
      currentNetBalance: Number(s.netBalance),
    }))
    hotelSellersForRequests.forEach((h) => sellerMap.set(h.id, {
      storeName: h.hotels[0]?.name || h.businessInfo?.businessName || h.user.name || "Hotel Partner",
      ownerName: h.user.name,
      email: h.user.email,
      phone: h.user.phone,
      bankDetails: h.bankDetails,
      currentNetBalance: Number(h.netBalance),
    }))
    restaurantSellersForRequests.forEach((r) => sellerMap.set(r.id, {
      storeName: r.businessInfo?.businessName || r.user.name || "Restaurant Partner",
      ownerName: r.user.name,
      email: r.user.email,
      phone: r.user.phone,
      bankDetails: r.bankDetails,
      currentNetBalance: Number(r.netBalance),
    }))
    ridersForRequests.forEach((r) => sellerMap.set(r.id, {
      storeName: `Rider: ${r.user?.name || "Delivery Partner"}`,
      ownerName: r.user?.name || "Rider",
      email: r.user?.email,
      phone: r.user?.phone,
      bankDetails: {
        paymentOption: r.paymentOption,
        preferredPayoutMethod: r.preferredPayoutMethod,
        bankName: r.bankName,
        accountHolderName: r.accountHolderName,
        accountNumber: r.accountNumber,
        mobileNumber: r.mobileNumber,
        mobileMoneyOption: r.mobileMoneyOption,
      },
      currentNetBalance: Number(r.netBalance),
    }))

    const pendingRequests = pendingRequestsRaw.map((req) => {
      const sellerInfo = sellerMap.get(req.sellerId)
      return {
        ...req,
        sellerStoreName: sellerInfo?.storeName || "Vendor",
        sellerOwnerName: sellerInfo?.ownerName || "Seller",
        sellerEmail: sellerInfo?.email || "",
        sellerPhone: sellerInfo?.phone || "",
        currentNetBalance: sellerInfo?.currentNetBalance ?? req.requestedAmount,
        payoutAccountSnapshot: req.payoutAccountSnapshot || formatAccountSnapshot(sellerInfo?.bankDetails),
      }
    })

    const disbursedHistory = disbursedHistoryRaw.map((req) => {
      const sellerInfo = sellerMap.get(req.sellerId)
      return {
        ...req,
        sellerStoreName: sellerInfo?.storeName || "Vendor",
        sellerOwnerName: sellerInfo?.ownerName || "Seller",
        sellerEmail: sellerInfo?.email || "",
      }
    })

    // Construct Yet to Pay Seller list across all sectors
    const yetToPaySellers = [
      ...productSellers.map((s) => ({
        sellerId: s.id,
        sellerSector: s.type === "SERVICE" ? ("SERVICE" as const) : ("PRODUCT" as const),
        storeName: s.store?.name || s.user.name || (s.type === "SERVICE" ? "Service Provider" : "Store"),
        ownerName: s.user.name,
        email: s.user.email,
        phone: s.user.phone ? `${s.user.phoneCountryCode || ""}${s.user.phone}` : null,
        netBalance: Number(s.netBalance),
        payoutMethod: s.bankDetails?.paymentOption || s.bankDetails?.preferredPayoutMethod || "AfriMoney / Bank",
        payoutAccountSnapshot: formatAccountSnapshot(s.bankDetails),
        hasPendingRequest: pendingRequestsRaw.some((p) => p.sellerId === s.id),
      })),
      ...hotelSellers.map((h) => ({
        sellerId: h.id,
        sellerSector: "HOTEL",
        storeName: h.hotels[0]?.name || h.businessInfo?.businessName || h.user.name || "Hotel",
        ownerName: h.user.name,
        email: h.user.email,
        phone: h.user.phone ? `${h.user.phoneCountryCode || ""}${h.user.phone}` : null,
        netBalance: Number(h.netBalance),
        payoutMethod: h.bankDetails?.paymentOption || h.bankDetails?.preferredPayoutMethod || "AfriMoney / Bank",
        payoutAccountSnapshot: formatAccountSnapshot(h.bankDetails),
        hasPendingRequest: pendingRequestsRaw.some((p) => p.sellerId === h.id),
      })),
      ...restaurantSellers.map((r) => ({
        sellerId: r.id,
        sellerSector: "RESTAURANT",
        storeName: r.businessInfo?.businessName || r.user.name || "Restaurant",
        ownerName: r.user.name,
        email: r.user.email,
        phone: r.user.phone ? `${r.user.phoneCountryCode || ""}${r.user.phone}` : null,
        netBalance: Number(r.netBalance),
        payoutMethod: r.bankDetails?.paymentOption || r.bankDetails?.preferredPayoutMethod || "AfriMoney / Bank",
        payoutAccountSnapshot: formatAccountSnapshot(r.bankDetails),
        hasPendingRequest: pendingRequestsRaw.some((p) => p.sellerId === r.id),
      })),
      ...riders.map((r) => ({
        sellerId: r.id,
        sellerSector: "RIDER" as const,
        storeName: `Rider: ${r.user?.name || "Delivery Partner"}`,
        ownerName: r.user?.name || "Rider",
        email: r.user?.email || "",
        phone: r.user?.phone ? `${r.user?.phoneCountryCode || ""}${r.user?.phone}` : null,
        netBalance: Number(r.netBalance),
        payoutMethod: r.paymentOption || r.preferredPayoutMethod || r.mobileMoneyOption || "AfriMoney / Bank",
        payoutAccountSnapshot: formatAccountSnapshot({
          paymentOption: r.paymentOption,
          bankName: r.bankName,
          accountHolderName: r.accountHolderName,
          accountNumber: r.accountNumber,
          mobileNumber: r.mobileNumber,
          mobileMoneyOption: r.mobileMoneyOption,
        }),
        hasPendingRequest: pendingRequestsRaw.some((p) => p.sellerId === r.id),
      })),
    ].sort((a, b) => b.netBalance - a.netBalance)

    // Summary metrics
    const totalYetToPay = yetToPaySellers.reduce((sum, s) => sum + s.netBalance, 0)
    const totalPendingRequested = pendingRequests.reduce((sum, p) => sum + p.requestedAmount, 0)
    const totalDisbursed = disbursedAgg._sum.requestedAmount || 0

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalYetToPay,
          totalPendingRequested,
          pendingCount: pendingRequests.length,
          totalDisbursed,
          disbursedCount: totalDisbursedCount,
          totalYetToPaySellersCount: yetToPaySellers.length,
        },
        pendingRequests,
        yetToPaySellers,
        disbursedHistory,
      },
    })
  } catch (error) {
    console.error("Admin GET /api/admin/payouts error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

