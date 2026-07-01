import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { HotelSellerDetailClient } from "./hotel-seller-detail-client"
import { getPresignedUrlOrOriginal } from "@/lib/s3-presigned"

export default async function HotelSellerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }

  const { id } = await params

  const seller = await prisma.hotelSeller.findUnique({
    where: { id },
    include: {
      user: true,
      businessInfo: true,
      kyc: true,
      bankDetails: true,
      agreement: true,

      hotels: {
        where: { isDeleted: false },
        include: {
          _count: { select: { rooms: true } }
        }
      }
    }
  })

  if (!seller) notFound()

  // Pre-sign all private S3 document URLs
  const [logo, banner, mainPhoto] = await Promise.all([
    getPresignedUrlOrOriginal(seller.logo),
    getPresignedUrlOrOriginal(seller.banner),
    getPresignedUrlOrOriginal(seller.mainPhoto)
  ])
  seller.logo = logo
  seller.banner = banner
  seller.mainPhoto = mainPhoto

  if (seller.businessInfo) {
    const [busReg, cityCouncil, gstTin, addressProof] = await Promise.all([
      getPresignedUrlOrOriginal(seller.businessInfo.busRegCertUrl),
      getPresignedUrlOrOriginal(seller.businessInfo.cityCouncilCertUrl),
      getPresignedUrlOrOriginal(seller.businessInfo.gstTinCertUrl),
      getPresignedUrlOrOriginal(seller.businessInfo.addressProofUrl)
    ])
    seller.businessInfo.busRegCertUrl = busReg
    seller.businessInfo.cityCouncilCertUrl = cityCouncil
    seller.businessInfo.gstTinCertUrl = gstTin
    seller.businessInfo.addressProofUrl = addressProof
  }

  if (seller.kyc) {
    const [idFront, idBack, selfie] = await Promise.all([
      getPresignedUrlOrOriginal(seller.kyc.idFrontUrl),
      getPresignedUrlOrOriginal(seller.kyc.idBackUrl),
      getPresignedUrlOrOriginal(seller.kyc.selfieUrl)
    ])
    seller.kyc.idFrontUrl = idFront
    seller.kyc.idBackUrl = idBack
    seller.kyc.selfieUrl = selfie
  }

  if (seller.bankDetails) {
    const [passbook, bankLetter] = await Promise.all([
      getPresignedUrlOrOriginal(seller.bankDetails.passbookUrl),
      getPresignedUrlOrOriginal(seller.bankDetails.bankLetterUrl)
    ])
    seller.bankDetails.passbookUrl = passbook
    seller.bankDetails.bankLetterUrl = bankLetter
  }



  if (seller.hotels) {
    seller.hotels = await Promise.all(
      seller.hotels.map(async (hotel) => {
        hotel.logo = await getPresignedUrlOrOriginal(hotel.logo)
        hotel.banner = await getPresignedUrlOrOriginal(hotel.banner)
        let parsedImages = []
        try {
          parsedImages = typeof hotel.images === 'string' ? JSON.parse(hotel.images) : hotel.images
        } catch (e) {}
        if (Array.isArray(parsedImages)) {
          hotel.images = await Promise.all(parsedImages.map(img => getPresignedUrlOrOriginal(img)))
        }
        return hotel
      })
    )
  }

  return <HotelSellerDetailClient seller={JSON.parse(JSON.stringify(seller))} />
}
