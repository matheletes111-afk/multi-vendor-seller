import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"
import type { Prisma } from "@prisma/client"
import {
  validateProductOrServiceSellerApproval,
  validateHotelSellerApproval,
  validateRestaurantSellerApproval,
} from "@/lib/seller-approval-validation"
import {
  sendSellerApprovalEmail,
  sendSellerSuspensionEmail,
} from "@/lib/email"
import { getPresignedUrlOrOriginal } from "@/lib/s3-presigned"

export interface UnifiedSellerItem {
  id: string
  sellerType: "PRODUCT" | "SERVICE" | "HOTEL" | "RESTAURANT"
  userId: string
  userName: string | null
  userEmail: string | null
  userPhone: string | null
  businessName: string | null
  storeName?: string | null
  isApproved: boolean
  isSuspended: boolean
  status: string
  onboardingCompleted: boolean
  onboardingStep: number
  adminFeedback?: string | null
  createdAt: string | Date
  updatedAt: string | Date
  subscriptionPlan?: string | null
  itemsCount: number
  ordersCount?: number
  city?: string | null
  state?: string | null
  logo?: string | null
  banner?: string | null
  commissionRate?: number | null
  raw: any
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const { skip, take, page, perPage } = getPaginationFromSearchParams({
      page: searchParams.get("page") ?? undefined,
      perPage: searchParams.get("perPage") ?? undefined,
    })

    const search = searchParams.get("search")?.trim() || searchParams.get("q")?.trim() || ""
    const sellerTypeParam = (searchParams.get("sellerType") || searchParams.get("type") || "ALL").toUpperCase()
    const statusParam = (searchParams.get("status") || searchParams.get("tab") || "ALL").toUpperCase()
    const startDate = searchParams.get("startDate")?.trim()
    const endDate = searchParams.get("endDate")?.trim()

    // ── Build Date Filter ──
    const dateFilter: { gte?: Date; lte?: Date } = {}
    if (startDate) dateFilter.gte = new Date(startDate)
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      dateFilter.lte = end
    }
    const hasDateFilter = Object.keys(dateFilter).length > 0

    // ── Status helper ──
    const getStatusWhere = (status: string) => {
      switch (status) {
        case "PENDING":
          return { isApproved: false, status: { not: "REJECTED" as const } }
        case "APPROVED":
          return { isApproved: true, isSuspended: false }
        case "SUSPENDED":
          return { isSuspended: true }
        case "ONBOARDING":
          return { onboardingCompleted: false }
        case "REJECTED":
          return { status: "REJECTED" as const }
        case "CORRECTION":
        case "CORRECTION_NEEDED":
          return { status: "CORRECTION_NEEDED" as const }
        default:
          return {}
      }
    }

    const statusWhere = getStatusWhere(statusParam)

    // ── Prepare queries ──
    const queryProduct = sellerTypeParam === "ALL" || sellerTypeParam === "PRODUCT"
    const queryService = sellerTypeParam === "ALL" || sellerTypeParam === "SERVICE"
    const queryHotel = sellerTypeParam === "ALL" || sellerTypeParam === "HOTEL"
    const queryRestaurant = sellerTypeParam === "ALL" || sellerTypeParam === "RESTAURANT"

    // 1. Product & Service Seller where clause
    const sellerWhere: Prisma.SellerWhereInput = {
      ...statusWhere,
      ...(hasDateFilter ? { createdAt: dateFilter } : {}),
      ...(sellerTypeParam === "PRODUCT"
        ? { type: "PRODUCT" }
        : sellerTypeParam === "SERVICE"
        ? { type: "SERVICE" }
        : {}),
    }

    if (search) {
      sellerWhere.OR = [
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { user: { phone: { contains: search, mode: "insensitive" } } },
        { store: { name: { contains: search, mode: "insensitive" } } },
        { store: { city: { contains: search, mode: "insensitive" } } },
        { businessInfo: { businessName: { contains: search, mode: "insensitive" } } },
        { businessInfo: { city: { contains: search, mode: "insensitive" } } },
      ]
    }

    // 2. Hotel Seller where clause
    const hotelWhere: Prisma.HotelSellerWhereInput = {
      ...statusWhere,
      ...(hasDateFilter ? { createdAt: dateFilter } : {}),
    }

    if (search) {
      hotelWhere.OR = [
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { user: { phone: { contains: search, mode: "insensitive" } } },
        { businessInfo: { businessName: { contains: search, mode: "insensitive" } } },
        { businessInfo: { city: { contains: search, mode: "insensitive" } } },
        { hotels: { some: { name: { contains: search, mode: "insensitive" } } } },
      ]
    }

    // 3. Restaurant Seller where clause
    const restaurantWhere: Prisma.RestaurantSellerWhereInput = {
      ...statusWhere,
      ...(hasDateFilter ? { createdAt: dateFilter } : {}),
    }

    if (search) {
      restaurantWhere.OR = [
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { user: { phone: { contains: search, mode: "insensitive" } } },
        { businessInfo: { businessName: { contains: search, mode: "insensitive" } } },
        { businessInfo: { city: { contains: search, mode: "insensitive" } } },
      ]
    }

    // ── Fetch aggregate metrics & filtered counts concurrently ──
    const [
      totalProductCount,
      totalServiceCount,
      totalHotelCount,
      totalRestaurantCount,
      pendingProductCount,
      pendingHotelCount,
      pendingRestaurantCount,
      suspendedProductCount,
      suspendedHotelCount,
      suspendedRestaurantCount,
      approvedProductCount,
      approvedHotelCount,
      approvedRestaurantCount,
      filteredSellerCount,
      filteredHotelCount,
      filteredRestaurantCount,
    ] = await Promise.all([
      prisma.seller.count({ where: { type: "PRODUCT" } }),
      prisma.seller.count({ where: { type: "SERVICE" } }),
      prisma.hotelSeller.count(),
      prisma.restaurantSeller.count(),
      prisma.seller.count({ where: { isApproved: false, status: { not: "REJECTED" } } }),
      prisma.hotelSeller.count({ where: { isApproved: false, status: { not: "REJECTED" } } }),
      prisma.restaurantSeller.count({ where: { isApproved: false, status: { not: "REJECTED" } } }),
      prisma.seller.count({ where: { isSuspended: true } }),
      prisma.hotelSeller.count({ where: { isSuspended: true } }),
      prisma.restaurantSeller.count({ where: { isSuspended: true } }),
      prisma.seller.count({ where: { isApproved: true, isSuspended: false } }),
      prisma.hotelSeller.count({ where: { isApproved: true, isSuspended: false } }),
      prisma.restaurantSeller.count({ where: { isApproved: true, isSuspended: false } }),
      (queryProduct || queryService) ? prisma.seller.count({ where: sellerWhere }) : 0,
      queryHotel ? prisma.hotelSeller.count({ where: hotelWhere }) : 0,
      queryRestaurant ? prisma.restaurantSeller.count({ where: restaurantWhere }) : 0,
    ])

    const totalCount = filteredSellerCount + filteredHotelCount + filteredRestaurantCount
    const totalPages = Math.ceil(totalCount / perPage)

    // ── Fetch rows ──
    // Fetch sufficient records to merge and sort properly
    const fetchLimit = skip + take

    const [sellersRaw, hotelSellersRaw, restaurantSellersRaw] = (await Promise.all([
      (queryProduct || queryService)
        ? prisma.seller.findMany({
            where: sellerWhere,
            take: fetchLimit,
            include: {
              user: true,
              store: true,
              businessInfo: true,
              kyc: true,
              bankDetails: true,
              selectedCategories: true,
              selectedServiceCategories: true,
              agreement: true,
              subscription: { include: { plan: true } },
              _count: {
                select: {
                  products: true,
                  services: true,
                  orders: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          })
        : [],
      queryHotel
        ? prisma.hotelSeller.findMany({
            where: hotelWhere,
            take: fetchLimit,
            include: {
              user: true,
              businessInfo: true,
              kyc: true,
              bankDetails: true,
              agreement: true,
              subscription: { include: { plan: true } },
              hotels: true,
            },
            orderBy: { createdAt: "desc" },
          })
        : [],
      queryRestaurant
        ? prisma.restaurantSeller.findMany({
            where: restaurantWhere,
            take: fetchLimit,
            include: {
              user: true,
              businessInfo: true,
              kyc: true,
              bankDetails: true,
              agreement: true,
              subscription: { include: { plan: true } },
              foods: true,
              foodOrders: true,
            },
            orderBy: { createdAt: "desc" },
          })
        : [],
    ])) as [any[], any[], any[]]

    // ── Normalize to unified items ──
    const unifiedList: UnifiedSellerItem[] = []

    // 1. Sellers (Product / Service)
    for (const s of sellersRaw) {
      const isProduct = s.type === "PRODUCT"
      unifiedList.push({
        id: s.id,
        sellerType: isProduct ? "PRODUCT" : "SERVICE",
        userId: s.userId,
        userName: s.user?.name || null,
        userEmail: s.user?.email || null,
        userPhone: s.user?.phone || null,
        businessName: s.businessInfo?.businessName || s.store?.name || null,
        storeName: s.store?.name || null,
        isApproved: s.isApproved,
        isSuspended: s.isSuspended,
        status: s.status,
        onboardingCompleted: s.onboardingCompleted,
        onboardingStep: s.onboardingStep,
        adminFeedback: s.adminFeedback,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        subscriptionPlan: s.subscription?.plan?.name || null,
        itemsCount: isProduct ? (s._count?.products ?? 0) : (s._count?.services ?? 0),
        ordersCount: s._count?.orders ?? 0,
        city: s.store?.city || s.businessInfo?.city || null,
        state: s.store?.state || s.businessInfo?.district || null,
        logo: s.store?.logo || null,
        banner: s.store?.banner || null,
        commissionRate: s.commissionRate,
        raw: s,
      })
    }

    // 2. Hotel Sellers
    for (const h of hotelSellersRaw) {
      unifiedList.push({
        id: h.id,
        sellerType: "HOTEL",
        userId: h.userId,
        userName: h.user?.name || null,
        userEmail: h.user?.email || null,
        userPhone: h.user?.phone || null,
        businessName: h.businessInfo?.businessName || h.hotels?.[0]?.name || null,
        storeName: h.hotels?.[0]?.name || null,
        isApproved: h.isApproved,
        isSuspended: h.isSuspended,
        status: h.status,
        onboardingCompleted: h.onboardingCompleted,
        onboardingStep: h.onboardingStep,
        adminFeedback: h.adminFeedback,
        createdAt: h.createdAt,
        updatedAt: h.updatedAt,
        subscriptionPlan: h.subscription?.plan?.name || null,
        itemsCount: h.hotels?.length ?? 0,
        city: h.businessInfo?.city || h.hotels?.[0]?.city || null,
        state: h.businessInfo?.state || h.hotels?.[0]?.state || null,
        logo: h.logo || null,
        banner: h.banner || null,
        commissionRate: h.commissionRate,
        raw: h,
      })
    }

    // 3. Restaurant Sellers
    for (const r of restaurantSellersRaw) {
      unifiedList.push({
        id: r.id,
        sellerType: "RESTAURANT",
        userId: r.userId,
        userName: r.user?.name || null,
        userEmail: r.user?.email || null,
        userPhone: r.user?.phone || null,
        businessName: r.businessInfo?.businessName || null,
        storeName: null,
        isApproved: r.isApproved,
        isSuspended: r.isSuspended,
        status: r.status,
        onboardingCompleted: r.onboardingCompleted,
        onboardingStep: r.onboardingStep,
        adminFeedback: r.adminFeedback,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        subscriptionPlan: r.subscription?.plan?.name || null,
        itemsCount: r.foods?.length ?? 0,
        ordersCount: r.foodOrders?.length ?? 0,
        city: r.businessInfo?.city || null,
        state: r.businessInfo?.state || null,
        logo: r.logo || null,
        banner: r.banner || null,
        commissionRate: r.commissionRate,
        raw: r,
      })
    }

    // Sort descending by registration date
    unifiedList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Slice to current page
    const pagedItems = unifiedList.slice(skip, skip + take)

    // Presign document URLs for items on this page
    await Promise.all(
      pagedItems.map(async (item) => {
        if (item.logo) item.logo = await getPresignedUrlOrOriginal(item.logo)
        if (item.banner) item.banner = await getPresignedUrlOrOriginal(item.banner)

        if (item.raw?.businessInfo) {
          const [busReg, cityCouncil, gstTin, addrProof] = await Promise.all([
            getPresignedUrlOrOriginal(item.raw.businessInfo.busRegCertUrl),
            getPresignedUrlOrOriginal(item.raw.businessInfo.cityCouncilCertUrl),
            getPresignedUrlOrOriginal(item.raw.businessInfo.gstTinCertUrl),
            getPresignedUrlOrOriginal(item.raw.businessInfo.addressProofUrl),
          ])
          item.raw.businessInfo.busRegCertUrl = busReg
          item.raw.businessInfo.cityCouncilCertUrl = cityCouncil
          item.raw.businessInfo.gstTinCertUrl = gstTin
          item.raw.businessInfo.addressProofUrl = addrProof
        }

        if (item.raw?.kyc) {
          const [front, back, selfie] = await Promise.all([
            getPresignedUrlOrOriginal(item.raw.kyc.idFrontUrl),
            getPresignedUrlOrOriginal(item.raw.kyc.idBackUrl),
            getPresignedUrlOrOriginal(item.raw.kyc.selfieUrl),
          ])
          item.raw.kyc.idFrontUrl = front
          item.raw.kyc.idBackUrl = back
          item.raw.kyc.selfieUrl = selfie
          if (item.raw.kyc.foodLicenseUrl) {
            item.raw.kyc.foodLicenseUrl = await getPresignedUrlOrOriginal(item.raw.kyc.foodLicenseUrl)
          }
        }

        if (item.raw?.bankDetails) {
          const [passbook, letter] = await Promise.all([
            getPresignedUrlOrOriginal(item.raw.bankDetails.passbookUrl),
            getPresignedUrlOrOriginal(item.raw.bankDetails.bankLetterUrl),
          ])
          item.raw.bankDetails.passbookUrl = passbook
          item.raw.bankDetails.bankLetterUrl = letter
        }
      })
    )

    const stats = {
      totalAll: totalProductCount + totalServiceCount + totalHotelCount + totalRestaurantCount,
      totalProduct: totalProductCount,
      totalService: totalServiceCount,
      totalHotel: totalHotelCount,
      totalRestaurant: totalRestaurantCount,
      totalPending: pendingProductCount + pendingHotelCount + pendingRestaurantCount,
      totalSuspended: suspendedProductCount + suspendedHotelCount + suspendedRestaurantCount,
      totalApproved: approvedProductCount + approvedHotelCount + approvedRestaurantCount,
    }

    return NextResponse.json({
      sellers: pagedItems,
      totalCount,
      totalPages,
      page,
      perPage,
      stats,
    })
  } catch (error: any) {
    console.error("Error fetching all sellers:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to fetch master sellers directory" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/all-sellers
 * Bulk / single actions for all 4 seller types: approve, suspend, unsuspend, reject, correction.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { action, sellers, feedback } = body as {
      action: "approve" | "suspend" | "unsuspend" | "reject" | "correction"
      sellers: Array<{ id: string; type: "PRODUCT" | "SERVICE" | "HOTEL" | "RESTAURANT" }>
      feedback?: string
    }

    if (!action || !sellers || !Array.isArray(sellers) || sellers.length === 0) {
      return NextResponse.json({ error: "Action and sellers list are required" }, { status: 400 })
    }

    const results: Array<{
      id: string
      type: string
      name?: string
      success: boolean
      error?: string
    }> = []

    for (const item of sellers) {
      const { id, type } = item
      try {
        if (type === "PRODUCT" || type === "SERVICE") {
          const seller = await prisma.seller.findUnique({
            where: { id },
            include: {
              user: true,
              store: true,
              businessInfo: true,
              kyc: true,
              bankDetails: true,
              selectedCategories: true,
              selectedServiceCategories: true,
              agreement: true,
            },
          })

          if (!seller) {
            results.push({ id, type, success: false, error: "Seller not found" })
            continue
          }

          const sellerName = seller.store?.name || seller.businessInfo?.businessName || seller.user?.name || "Seller"

          if (action === "approve") {
            const validation = validateProductOrServiceSellerApproval(seller)
            if (!validation.canApprove) {
              results.push({
                id,
                type,
                name: sellerName,
                success: false,
                error: `Incomplete onboarding: ${validation.missingItems.join(". ")}`,
              })
              continue
            }

            await prisma.seller.update({
              where: { id },
              data: {
                isApproved: true,
                onboardingCompleted: true,
                status: "APPROVED",
                isSuspended: false,
                adminFeedback: feedback || null,
              },
            })

            if (seller.user?.email) {
              try {
                await sendSellerApprovalEmail({
                  to: seller.user.email,
                  name: seller.user.name ?? sellerName,
                })
              } catch (e) {
                console.error("Email send error:", e)
              }
            }
          } else if (action === "suspend") {
            await prisma.seller.update({
              where: { id },
              data: { isSuspended: true, adminFeedback: feedback || null },
            })
            if (seller.user?.email) {
              try {
                await sendSellerSuspensionEmail({
                  to: seller.user.email,
                  name: seller.user.name ?? sellerName,
                  isSuspended: true,
                })
              } catch (e) {
                console.error("Email send error:", e)
              }
            }
          } else if (action === "unsuspend") {
            await prisma.seller.update({
              where: { id },
              data: { isSuspended: false },
            })
            if (seller.user?.email) {
              try {
                await sendSellerSuspensionEmail({
                  to: seller.user.email,
                  name: seller.user.name ?? sellerName,
                  isSuspended: false,
                })
              } catch (e) {
                console.error("Email send error:", e)
              }
            }
          } else if (action === "reject") {
            await prisma.seller.update({
              where: { id },
              data: { isApproved: false, status: "REJECTED", adminFeedback: feedback || null },
            })
          } else if (action === "correction") {
            await prisma.seller.update({
              where: { id },
              data: { isApproved: false, status: "CORRECTION_NEEDED", adminFeedback: feedback || null },
            })
          }

          results.push({ id, type, name: sellerName, success: true })
        } else if (type === "HOTEL") {
          const hotelSeller = await prisma.hotelSeller.findUnique({
            where: { id },
            include: {
              user: true,
              businessInfo: true,
              kyc: true,
              bankDetails: true,
              agreement: true,
            },
          })

          if (!hotelSeller) {
            results.push({ id, type, success: false, error: "Hotel seller not found" })
            continue
          }

          const sellerName = hotelSeller.businessInfo?.businessName || hotelSeller.user?.name || "Hotel Partner"

          if (action === "approve") {
            const validation = validateHotelSellerApproval(hotelSeller)
            if (!validation.canApprove) {
              results.push({
                id,
                type,
                name: sellerName,
                success: false,
                error: `Incomplete onboarding: ${validation.missingItems.join(". ")}`,
              })
              continue
            }

            await prisma.hotelSeller.update({
              where: { id },
              data: {
                isApproved: true,
                onboardingCompleted: true,
                status: "APPROVED",
                isSuspended: false,
                adminFeedback: feedback || null,
              },
            })

            if (hotelSeller.user?.email) {
              try {
                await sendSellerApprovalEmail({
                  to: hotelSeller.user.email,
                  name: hotelSeller.user.name ?? sellerName,
                })
              } catch (e) {
                console.error("Email send error:", e)
              }
            }
          } else if (action === "suspend") {
            await prisma.hotelSeller.update({
              where: { id },
              data: { isSuspended: true, adminFeedback: feedback || null },
            })
            if (hotelSeller.user?.email) {
              try {
                await sendSellerSuspensionEmail({
                  to: hotelSeller.user.email,
                  name: hotelSeller.user.name ?? sellerName,
                  isSuspended: true,
                })
              } catch (e) {
                console.error("Email send error:", e)
              }
            }
          } else if (action === "unsuspend") {
            await prisma.hotelSeller.update({
              where: { id },
              data: { isSuspended: false },
            })
            if (hotelSeller.user?.email) {
              try {
                await sendSellerSuspensionEmail({
                  to: hotelSeller.user.email,
                  name: hotelSeller.user.name ?? sellerName,
                  isSuspended: false,
                })
              } catch (e) {
                console.error("Email send error:", e)
              }
            }
          } else if (action === "reject") {
            await prisma.hotelSeller.update({
              where: { id },
              data: { isApproved: false, status: "REJECTED", adminFeedback: feedback || null },
            })
          } else if (action === "correction") {
            await prisma.hotelSeller.update({
              where: { id },
              data: { isApproved: false, status: "CORRECTION_NEEDED", adminFeedback: feedback || null },
            })
          }

          results.push({ id, type, name: sellerName, success: true })
        } else if (type === "RESTAURANT") {
          const restaurantSeller = await prisma.restaurantSeller.findUnique({
            where: { id },
            include: {
              user: true,
              businessInfo: true,
              kyc: true,
              bankDetails: true,
              agreement: true,
            },
          })

          if (!restaurantSeller) {
            results.push({ id, type, success: false, error: "Restaurant seller not found" })
            continue
          }

          const sellerName = restaurantSeller.businessInfo?.businessName || restaurantSeller.user?.name || "Restaurant Partner"

          if (action === "approve") {
            const validation = validateRestaurantSellerApproval(restaurantSeller)
            if (!validation.canApprove) {
              results.push({
                id,
                type,
                name: sellerName,
                success: false,
                error: `Incomplete onboarding: ${validation.missingItems.join(". ")}`,
              })
              continue
            }

            await prisma.restaurantSeller.update({
              where: { id },
              data: {
                isApproved: true,
                onboardingCompleted: true,
                status: "APPROVED",
                isSuspended: false,
                adminFeedback: feedback || null,
              },
            })

            if (restaurantSeller.user?.email) {
              try {
                await sendSellerApprovalEmail({
                  to: restaurantSeller.user.email,
                  name: restaurantSeller.user.name ?? sellerName,
                })
              } catch (e) {
                console.error("Email send error:", e)
              }
            }
          } else if (action === "suspend") {
            await prisma.restaurantSeller.update({
              where: { id },
              data: { isSuspended: true, adminFeedback: feedback || null },
            })
            if (restaurantSeller.user?.email) {
              try {
                await sendSellerSuspensionEmail({
                  to: restaurantSeller.user.email,
                  name: restaurantSeller.user.name ?? sellerName,
                  isSuspended: true,
                })
              } catch (e) {
                console.error("Email send error:", e)
              }
            }
          } else if (action === "unsuspend") {
            await prisma.restaurantSeller.update({
              where: { id },
              data: { isSuspended: false },
            })
            if (restaurantSeller.user?.email) {
              try {
                await sendSellerSuspensionEmail({
                  to: restaurantSeller.user.email,
                  name: restaurantSeller.user.name ?? sellerName,
                  isSuspended: false,
                })
              } catch (e) {
                console.error("Email send error:", e)
              }
            }
          } else if (action === "reject") {
            await prisma.restaurantSeller.update({
              where: { id },
              data: { isApproved: false, status: "REJECTED", adminFeedback: feedback || null },
            })
          } else if (action === "correction") {
            await prisma.restaurantSeller.update({
              where: { id },
              data: { isApproved: false, status: "CORRECTION_NEEDED", adminFeedback: feedback || null },
            })
          }

          results.push({ id, type, name: sellerName, success: true })
        } else {
          results.push({ id, type, success: false, error: `Invalid seller type: ${type}` })
        }
      } catch (err: any) {
        console.error(`Error processing seller ${id}:`, err)
        results.push({ id, type, success: false, error: err?.message || "Internal server error" })
      }
    }

    const succeededCount = results.filter((r) => r.success).length
    const failedCount = results.filter((r) => !r.success).length

    return NextResponse.json({
      success: failedCount === 0,
      total: sellers.length,
      succeeded: succeededCount,
      failed: failedCount,
      results,
    })
  } catch (error: any) {
    console.error("Bulk action failed:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to execute bulk action" },
      { status: 500 }
    )
  }
}
