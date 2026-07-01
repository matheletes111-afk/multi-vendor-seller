import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { RestaurantSellerDetailClient } from "./restaurant-seller-detail-client"
import { getPresignedUrlOrOriginal } from "@/lib/s3-presigned"

export default async function RestaurantSellerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }

  const { id } = await params

  const seller = await prisma.restaurantSeller.findUnique({
    where: { id },
    include: {
      user: true,
      businessInfo: true,
      kyc: true,
      bankDetails: true,
      agreement: true,
    }
  })

  if (!seller) notFound()

  // Pre-sign S3 URLs
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

  // Serialize to plain object for client component
  const plainSeller = JSON.parse(JSON.stringify(seller))

  return <RestaurantSellerDetailClient seller={plainSeller} />
}
