import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") ?? "1")
    const perPage = parseInt(searchParams.get("perPage") ?? "10")
    const search = searchParams.get("search")
    const tab = searchParams.get("tab") ?? "all"

    const skip = (page - 1) * perPage
    const take = perPage

    let where: any = {}

    if (tab === "pending") {
       where = { ...where, isApproved: false, status: { not: "REJECTED" } }
    } else if (tab === "approved") {
       where = { ...where, isApproved: true, isSuspended: false }
    } else if (tab === "suspended") {
       where = { ...where, isSuspended: true }
    }

    if (search) {
       where = {
          ...where,
          OR: [
             { user: { name: { contains: search, mode: "insensitive" } } },
             { businessInfo: { businessName: { contains: search, mode: "insensitive" } } },
             { user: { email: { contains: search, mode: "insensitive" } } },
          ]
       }
    }

    const [sellers, totalCount] = await Promise.all([
      prisma.restaurantSeller.findMany({
        where,
        skip,
        take,
        include: {
          user: true,
          businessInfo: true,
          kyc: true,
          bankDetails: true,
          agreement: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.restaurantSeller.count({ where }),
    ])

    const { getPresignedUrlOrOriginal } = await import("@/lib/s3-presigned")
    const signedSellers = await Promise.all(sellers.map(async (seller) => {
      seller.logo = await getPresignedUrlOrOriginal(seller.logo)
      seller.banner = await getPresignedUrlOrOriginal(seller.banner)
      seller.mainPhoto = await getPresignedUrlOrOriginal(seller.mainPhoto)

      if (seller.businessInfo) {
        const [busReg, cityCouncil, gstTin, addrProof] = await Promise.all([
          getPresignedUrlOrOriginal(seller.businessInfo.busRegCertUrl),
          getPresignedUrlOrOriginal(seller.businessInfo.cityCouncilCertUrl),
          getPresignedUrlOrOriginal(seller.businessInfo.gstTinCertUrl),
          getPresignedUrlOrOriginal(seller.businessInfo.addressProofUrl)
        ])
        seller.businessInfo.busRegCertUrl = busReg
        seller.businessInfo.cityCouncilCertUrl = cityCouncil
        seller.businessInfo.gstTinCertUrl = gstTin
        seller.businessInfo.addressProofUrl = addrProof
      }

      if (seller.kyc) {
        const [front, back, selfie, license] = await Promise.all([
          getPresignedUrlOrOriginal(seller.kyc.idFrontUrl),
          getPresignedUrlOrOriginal(seller.kyc.idBackUrl),
          getPresignedUrlOrOriginal(seller.kyc.selfieUrl),
          getPresignedUrlOrOriginal(seller.kyc.foodLicenseUrl)
        ])
        seller.kyc.idFrontUrl = front
        seller.kyc.idBackUrl = back
        seller.kyc.selfieUrl = selfie
        seller.kyc.foodLicenseUrl = license
      }

      if (seller.bankDetails) {
        const [passbook, bankLetter] = await Promise.all([
          getPresignedUrlOrOriginal(seller.bankDetails.passbookUrl),
          getPresignedUrlOrOriginal(seller.bankDetails.bankLetterUrl)
        ])
        seller.bankDetails.passbookUrl = passbook
        seller.bankDetails.bankLetterUrl = bankLetter
      }

      return seller
    }))

    const totalPages = Math.ceil(totalCount / perPage)
    return NextResponse.json({
      sellers: signedSellers,
      totalCount,
      totalPages,
      page,
      perPage,
    })
  } catch (error) {
    console.error("Restaurant sellers fetch error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
