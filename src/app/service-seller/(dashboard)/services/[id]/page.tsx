import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isServiceSeller } from "@/lib/rbac"
import { parseServiceImagesForSellerForm } from "@/lib/service-images"
import { redirect } from "next/navigation"
import { EditServiceClient } from "./edit-service-client"

export default async function EditServicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const session = await auth()

  if (!session?.user || !isServiceSeller(session.user)) {
    redirect("/service-seller/login")
  }

  const { id } = await params
  const searchParamsResolved = await searchParams

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller) {
    redirect("/service-seller/services?error=seller_not_found")
  }

  const service = await prisma.service.findFirst({
    where: {
      id,
      sellerId: seller.id,
    },
    include: {
      serviceCategory: true,
    },
  })

  if (!service) {
    redirect("/service-seller/services?error=service_not_found")
  }

  const sellerWithCats = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: {
      selectedServiceCategories: {
        where: { isActive: true },
        orderBy: { name: "asc" },
      },
    },
  })
  const categories = sellerWithCats?.selectedServiceCategories || []

  const { masterUrl, galleryUrls } = parseServiceImagesForSellerForm({
    images: service.images,
    galleryImages: service.galleryImages,
  })

  return (
    <EditServiceClient
      service={{
        id: service.id,
        name: service.name,
        description: service.description,
        serviceCategoryId: service.serviceCategoryId,
        serviceType: service.serviceType,
        basePrice: service.basePrice,
        discount: service.discount,
        hasGst: service.hasGst,
        duration: service.duration,
        isActive: service.isActive,
        weeklyAvailability: service.weeklyAvailability,
      }}
      categories={categories}
      masterUrl={masterUrl}
      galleryUrls={galleryUrls}
      initialError={searchParamsResolved.error ? decodeURIComponent(searchParamsResolved.error) : undefined}
      initialSuccess={searchParamsResolved.success ? decodeURIComponent(searchParamsResolved.success) : undefined}
    />
  )
}
