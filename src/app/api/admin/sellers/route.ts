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
        ],
      }
    }

    // Fetch all records matching WHERE to perform document evaluation, filter by docStatus and sort accurately
    const sellersRaw = await prisma.seller.findMany({
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
    })

    // Attach document evaluation to each seller
    let processedSellers = sellersRaw.map((seller) => {
      const docEval = evaluateSellerDocuments(seller, seller.type)
      return {
        ...seller,
        documentEvaluation: docEval,
      }
    })

    // Filter by document status if requested
    if (docStatus === "COMPLETE") {
      processedSellers = processedSellers.filter((s) => s.documentEvaluation?.isComplete === true)
    } else if (docStatus === "INCOMPLETE") {
      processedSellers = processedSellers.filter((s) => s.documentEvaluation?.isComplete === false)
    }

    // Multi-column sorting
    const modifier = sortOrder === "asc" ? 1 : -1
    processedSellers.sort((a: any, b: any) => {
      switch (sortBy) {
        case "name": {
          const valA = (a.user?.name || a.user?.email || "").toLowerCase()
          const valB = (b.user?.name || b.user?.email || "").toLowerCase()
          return valA.localeCompare(valB) * modifier
        }
        case "email": {
          const valA = (a.user?.email || "").toLowerCase()
          const valB = (b.user?.email || "").toLowerCase()
          return valA.localeCompare(valB) * modifier
        }
        case "store":
        case "storename":
        case "businessname": {
          const valA = (a.store?.name || a.businessInfo?.businessName || "").toLowerCase()
          const valB = (b.store?.name || b.businessInfo?.businessName || "").toLowerCase()
          return valA.localeCompare(valB) * modifier
        }
        case "type":
        case "sellertype": {
          return a.type.localeCompare(b.type) * modifier
        }
        case "status": {
          const valA = a.isSuspended ? "SUSPENDED" : a.isApproved ? "APPROVED" : a.status || "PENDING"
          const valB = b.isSuspended ? "SUSPENDED" : b.isApproved ? "APPROVED" : b.status || "PENDING"
          return valA.localeCompare(valB) * modifier
        }
        case "plan":
        case "subscription":
        case "subscriptionplan": {
          const valA = (a.subscription?.plan?.displayName || a.subscription?.plan?.name || "Free").toLowerCase()
          const valB = (b.subscription?.plan?.displayName || b.subscription?.plan?.name || "Free").toLowerCase()
          return valA.localeCompare(valB) * modifier
        }
        case "commission":
        case "commissionrate": {
          const valA = a.commissionRate ?? -1
          const valB = b.commissionRate ?? -1
          return (valA - valB) * modifier
        }
        case "documents":
        case "docstatus": {
          const valA = a.documentEvaluation?.isComplete ? 1 : 0
          const valB = b.documentEvaluation?.isComplete ? 1 : 0
          if (valA !== valB) return (valA - valB) * modifier
          return ((b.documentEvaluation?.missingCount ?? 0) - (a.documentEvaluation?.missingCount ?? 0)) * modifier
        }
        case "date":
        case "createdat":
        default: {
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * modifier
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
    })
  } catch (error) {
    console.error("Error fetching sellers:", error)
    return NextResponse.json(
      { error: "Failed to fetch sellers" },
      { status: 500 }
    )
  }
}
