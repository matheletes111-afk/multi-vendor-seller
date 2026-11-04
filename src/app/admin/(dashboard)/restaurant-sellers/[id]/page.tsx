import { Suspense } from "react"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { RestaurantSellerDetailClient } from "./restaurant-seller-detail-client"
import { getPresignedUrlOrOriginal } from "@/lib/s3-presigned"
import { PageLoader } from "@/components/ui/page-loader"

export default async function RestaurantSellerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }

  const { id } = await params

  // Try finding by primary cuid id first, fallback to userId
  let seller = await prisma.restaurantSeller.findUnique({
    where: { id },
    include: {
      user: true,
      businessInfo: true,
      kyc: true,
      bankDetails: true,
      agreement: true,
      subscription: {
        include: { plan: true }
      },
      subscriptionPurchases: {
        include: { plan: true },
        orderBy: { createdAt: "desc" }
      },
    }
  })

  if (!seller) {
    seller = await prisma.restaurantSeller.findUnique({
      where: { userId: id },
      include: {
        user: true,
        businessInfo: true,
        kyc: true,
        bankDetails: true,
        agreement: true,
        subscription: {
          include: { plan: true }
        },
        subscriptionPurchases: {
          include: { plan: true },
          orderBy: { createdAt: "desc" }
        },
      }
    })
  }

  if (!seller) notFound()

  const allPlans = await prisma.plan.findMany({
    where: { type: "RESTAURANT" },
    orderBy: { price: "asc" }
  })

  // Pre-sign S3 URLs
  seller.logo = await getPresignedUrlOrOriginal(seller.logo)
  seller.banner = await getPresignedUrlOrOriginal(seller.banner)
  seller.mainPhoto = await getPresignedUrlOrOriginal(seller.mainPhoto)

  if ((seller.businessInfo as any)?.busRegCertUrl) {
    (seller.businessInfo as any).busRegCertUrl = await getPresignedUrlOrOriginal(
      (seller.businessInfo as any).busRegCertUrl
    )
  }

  if (seller.kyc) {
    const [front, back] = await Promise.all([
      getPresignedUrlOrOriginal(seller.kyc.idFrontUrl),
      getPresignedUrlOrOriginal(seller.kyc.idBackUrl)
    ])
    seller.kyc.idFrontUrl = front
    seller.kyc.idBackUrl = back
  }

  if (seller.bankDetails) {
    const [passbook, bankLetter] = await Promise.all([
      getPresignedUrlOrOriginal(seller.bankDetails.passbookUrl),
      getPresignedUrlOrOriginal(seller.bankDetails.bankLetterUrl)
    ])
    seller.bankDetails.passbookUrl = passbook
    seller.bankDetails.bankLetterUrl = bankLetter
  }

  if ((seller.agreement as any)?.documentUrl) {
    (seller.agreement as any).documentUrl = await getPresignedUrlOrOriginal((seller.agreement as any).documentUrl)
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <RestaurantSellerDetailClient seller={JSON.parse(JSON.stringify(seller))} plans={JSON.parse(JSON.stringify(allPlans))} />
    </Suspense>
  )
}
