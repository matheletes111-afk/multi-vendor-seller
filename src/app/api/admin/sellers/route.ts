import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"
import type { Prisma } from "@prisma/client"
import { evaluateSellerDocuments } from "@/lib/seller-approval-validation"
import { buildDateRangeFilter } from "@/lib/admin-date-filters"
import { getPresignedUrlOrOriginal } from "@/lib/s3-presigned"

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
      defaultPerPage: 20,
    })

    const tab = searchParams.get("tab") ?? "all"
    const search = searchParams.get("search")?.trim() || searchParams.get("q")?.trim() || ""
    const type = searchParams.get("type") // "PRODUCT" or "SERVICE"
    const status = searchParams.get("status") // "PENDING", "APPROVED", "SUSPENDED", "ONBOARDING", "CORRECTION", "REJECTED"
    const timeframe = searchParams.get("timeframe")?.trim()
    const specificDate = searchParams.get("specificDate")?.trim()
    const startDate = searchParams.get("startDate")?.trim()
    const endDate = searchParams.get("endDate")?.trim()
    const docStatus = (searchParams.get("docStatus") || "ALL").toUpperCase()
    const sortBy = (searchParams.get("sortBy") || "createdAt").toLowerCase()
    const sortOrder = (searchParams.get("sortOrder") || "desc").toLowerCase() as "asc" | "desc"

    // ── Build Date Filter ──
    const dateFilter = buildDateRangeFilter({
      timeframe,
      specificDate,
      startDate,
      endDate,
    })

    let where: Prisma.SellerWhereInput = {}

    if (dateFilter) {
      where.createdAt = dateFilter
    }

    // ── Status Logic ──
    const effectiveStatus = status && status !== "all" ? status.toLowerCase() : tab.toLowerCase()
    if (effectiveStatus === "pending") {
      where = { ...where, isApproved: false, status: { not: "REJECTED" } }
    } else if (effectiveStatus === "approved") {
      where = { ...where, isApproved: true, isSuspended: false }
    } else if (effectiveStatus === "suspended") {
      where = { ...where, isSuspended: true }
    } else if (effectiveStatus === "onboarding") {
      where = { ...where, onboardingCompleted: false }
    } else if (effectiveStatus === "rejected") {
      where = { ...where, status: "REJECTED" }
    } else if (effectiveStatus === "correction" || effectiveStatus === "correction_needed") {
      where = { ...where, status: "CORRECTION_NEEDED" }
    }

    if (type && type !== "all" && type !== "ALL") {
      where = { ...where, type: type.toUpperCase() as any }
    }

    if (search) {
      where = {
        ...where,
        OR: [
          { user: { name: { contains: search, mode: "insensitive" } } },
          { user: { email: { contains: search, mode: "insensitive" } } },
          { user: { phone: { contains: search, mode: "insensitive" } } },
          { store: { name: { contains: search, mode: "insensitive" } } },
          { store: { city: { contains: search, mode: "insensitive" } } },
          { store: { state: { contains: search, mode: "insensitive" } } },
          { businessInfo: { businessName: { contains: search, mode: "insensitive" } } },
          { businessInfo: { city: { contains: search, mode: "insensitive" } } },
          { businessInfo: { businessRegNumber: { contains: search, mode: "insensitive" } } },
          { businessInfo: { taxIdNumber: { contains: search, mode: "insensitive" } } },
          { kyc: { idNumber: { contains: search, mode: "insensitive" } } },
          { agreement: { hearAboutUs: { contains: search, mode: "insensitive" } } },
        ],
      }
    }

    // Fetch global setting and all records matching WHERE to perform document evaluation, filter by docStatus and sort accurately
    const [globalSetting, sellersRaw] = await Promise.all([
      (prisma as any).globalSetting.findFirst({
        select: {
          baseCommission: true,
          productBaseCommission: true,
          serviceBaseCommission: true,
        },
      }) as Promise<{ baseCommission?: number; productBaseCommission?: number; serviceBaseCommission?: number } | null>,
      prisma.seller.findMany({
        where,
        include: {
          user: true,
          store: true,
          businessInfo: true,
          kyc: true,
          bankDetails: true,
          selectedCategories: true,
          selectedServiceCategories: true,
          agreement: true,
          subscription: {
            include: { plan: true },
          },
          _count: {
            select: {
              products: true,
              services: true,
              orders: true,
            },
          },
        } as any,
        orderBy: { createdAt: "desc" },
      }),
    ])

    const fallbackBaseCommission = globalSetting?.baseCommission ?? 10.0
    const productBaseCommission = globalSetting?.productBaseCommission ?? fallbackBaseCommission
    const serviceBaseCommission = globalSetting?.serviceBaseCommission ?? fallbackBaseCommission

    // Attach document evaluation and base commission rate to each seller
    let processedSellers = sellersRaw.map((seller: any) => {
      const docEval = evaluateSellerDocuments(seller, seller.type)
      const baseCommissionRate = seller.type === "SERVICE" ? serviceBaseCommission : productBaseCommission
      return {
        ...seller,
        baseCommissionRate,
        documentEvaluation: docEval,
      }
    })

    // Filter by document status if requested
    if (docStatus === "COMPLETE") {
      processedSellers = processedSellers.filter((s) => s.documentEvaluation?.isComplete === true)
    } else if (docStatus === "INCOMPLETE") {
      processedSellers = processedSellers.filter((s) => s.documentEvaluation?.isComplete === false)
    } else if (docStatus === "COMPLETE_UNDER_REVIEW" || docStatus === "DOC_COMPLETE_UNDER_REVIEW") {
      processedSellers = processedSellers.filter((s) => s.documentEvaluation?.isComplete === true && !s.isApproved && !s.isSuspended && s.status !== "REJECTED")
    }

    // Multi-column sorting
    const modifier = sortOrder === "asc" ? 1 : -1
    processedSellers.sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt).getTime() || 0
      const dateB = new Date(b.createdAt).getTime() || 0
      const newestFirst = dateB - dateA // Newer registration always comes first for tie-breakers

      switch (sortBy) {
        case "name": {
          const valA = (a.user?.name || a.user?.email || "").trim().toLowerCase()
          const valB = (b.user?.name || b.user?.email || "").trim().toLowerCase()
          if (!valA && valB) return 1
          if (valA && !valB) return -1
          const diff = valA.localeCompare(valB) * modifier
          if (diff !== 0) return diff
          return newestFirst
        }
        case "email": {
          const valA = (a.user?.email || "").trim().toLowerCase()
          const valB = (b.user?.email || "").trim().toLowerCase()
          if (!valA && valB) return 1
          if (valA && !valB) return -1
          const diff = valA.localeCompare(valB) * modifier
          if (diff !== 0) return diff
          return newestFirst
        }
        case "store":
        case "storename":
        case "businessname": {
          const valA = (a.businessInfo?.businessName || a.store?.name || a.user?.name || "").trim().toLowerCase()
          const valB = (b.businessInfo?.businessName || b.store?.name || b.user?.name || "").trim().toLowerCase()
          if (!valA && valB) return 1
          if (valA && !valB) return -1
          const diff = valA.localeCompare(valB) * modifier
          if (diff !== 0) return diff
          return newestFirst
        }
        case "type":
        case "sellertype": {
          const diff = (a.type || "").localeCompare(b.type || "") * modifier
          if (diff !== 0) return diff
          return newestFirst
        }
        case "status": {
          const getStatusRank = (item: any) => {
            if (item.isSuspended) return 6
            if (item.status === "REJECTED") return 5
            if (item.status === "CORRECTION" || item.status === "CORRECTION_NEEDED") return 4
            if (item.isApproved) return 1
            if (!item.onboardingCompleted) return 3
            return 2
          }
          const rankA = getStatusRank(a)
          const rankB = getStatusRank(b)
          const rankDiff = (rankA - rankB) * modifier
          if (rankDiff !== 0) return rankDiff
          return newestFirst
        }
        case "plan":
        case "subscription":
        case "subscriptionplan": {
          const valA = (a.subscription?.plan?.displayName || a.subscription?.plan?.name || "Free").toLowerCase()
          const valB = (b.subscription?.plan?.displayName || b.subscription?.plan?.name || "Free").toLowerCase()
          const diff = valA.localeCompare(valB) * modifier
          if (diff !== 0) return diff
          return newestFirst
        }
        case "commission":
        case "commissionrate": {
          const valA = a.commissionRate ?? a.baseCommissionRate ?? 10
          const valB = b.commissionRate ?? b.baseCommissionRate ?? 10
          const diff = (valA - valB) * modifier
          if (diff !== 0) return diff
          return newestFirst
        }
        case "documents":
        case "docstatus": {
          const completeA = a.documentEvaluation?.isComplete ? 1 : 0
          const completeB = b.documentEvaluation?.isComplete ? 1 : 0

          if (completeA !== completeB) {
            return sortOrder === "desc" ? (completeB - completeA) : (completeA - completeB)
          }

          const ratioA = a.documentEvaluation?.totalRequired
            ? (a.documentEvaluation.uploadedCount / a.documentEvaluation.totalRequired)
            : (completeA ? 1 : 0)
          const ratioB = b.documentEvaluation?.totalRequired
            ? (b.documentEvaluation.uploadedCount / b.documentEvaluation.totalRequired)
            : (completeB ? 1 : 0)

          if (ratioA !== ratioB) {
            return sortOrder === "desc" ? (ratioB - ratioA) : (ratioA - ratioB)
          }

          return newestFirst
        }
        case "doccompleteunderreview":
        case "documentcompleteunderreview":
        case "doc_complete_under_review": {
          const isTargetA = (a.documentEvaluation?.isComplete === true && !a.isApproved && !a.isSuspended && a.status !== "REJECTED") ? 1 : 0
          const isTargetB = (b.documentEvaluation?.isComplete === true && !b.isApproved && !b.isSuspended && b.status !== "REJECTED") ? 1 : 0
          if (isTargetA !== isTargetB) {
            return sortOrder === "asc" ? (isTargetA - isTargetB) : (isTargetB - isTargetA)
          }
          return newestFirst
        }
        case "date":
        case "createdat":
        default: {
          return sortOrder === "asc" ? (dateA - dateB) : (dateB - dateA)
        }
      }
    })

    const totalCount = processedSellers.length
    const totalPages = Math.ceil(totalCount / perPage)
    const pagedSellers = processedSellers.slice(skip, skip + take)

    // Presign document URLs for the items on the page
    const signedSellers = await Promise.all(
      pagedSellers.map(async (seller: any) => {
        if (seller.store?.logo) seller.store.logo = await getPresignedUrlOrOriginal(seller.store.logo)
        if (seller.store?.banner) seller.store.banner = await getPresignedUrlOrOriginal(seller.store.banner)

        if (seller.businessInfo) {
          const [busReg, cityCouncil, gstTin, addrProof] = await Promise.all([
            getPresignedUrlOrOriginal(seller.businessInfo.busRegCertUrl),
            getPresignedUrlOrOriginal(seller.businessInfo.cityCouncilCertUrl),
            getPresignedUrlOrOriginal(seller.businessInfo.gstTinCertUrl),
            getPresignedUrlOrOriginal(seller.businessInfo.addressProofUrl),
          ])
          seller.businessInfo.busRegCertUrl = busReg
          seller.businessInfo.cityCouncilCertUrl = cityCouncil
          seller.businessInfo.gstTinCertUrl = gstTin
          seller.businessInfo.addressProofUrl = addrProof
        }

        if (seller.kyc) {
          const [front, back, selfie] = await Promise.all([
            getPresignedUrlOrOriginal(seller.kyc.idFrontUrl),
            getPresignedUrlOrOriginal(seller.kyc.idBackUrl),
            getPresignedUrlOrOriginal(seller.kyc.selfieUrl),
          ])
          seller.kyc.idFrontUrl = front
          seller.kyc.idBackUrl = back
          seller.kyc.selfieUrl = selfie
        }

        if (seller.bankDetails) {
          const [passbook, bankLetter] = await Promise.all([
            getPresignedUrlOrOriginal(seller.bankDetails.passbookUrl),
            getPresignedUrlOrOriginal(seller.bankDetails.bankLetterUrl),
          ])
          seller.bankDetails.passbookUrl = passbook
          seller.bankDetails.bankLetterUrl = bankLetter
        }

        return seller
      })
    )

    return NextResponse.json({
      sellers: signedSellers,
      totalCount,
      totalPages,
      page,
      perPage,
      baseCommissions: {
        product: productBaseCommission,
        service: serviceBaseCommission,
        base: fallbackBaseCommission,
      },
    })
  } catch (error) {
    console.error("Error fetching sellers:", error)
    return NextResponse.json(
      { error: "Failed to fetch sellers" },
      { status: 500 }
    )
  }
}
