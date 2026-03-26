import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { ServiceDetailClient } from "./service-detail-client"
import { extractImageUrls, getServiceDisplayImageUrls, parseServiceImagesForSellerForm } from "@/lib/service-images"

export default async function ServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [service, ratingAgg] = await Promise.all([
    prisma.service.findUnique({
      where: { id, isActive: true },
      include: {
        serviceCategory: true,
        seller: { include: { store: true } },
        _count: { select: { reviews: true } },
        reviews: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            rating: true,
            comment: true,
            images: true,
            createdAt: true,
            isVerified: true,
            user: { select: { name: true } },
          },
        },
      },
    }),
    prisma.review.aggregate({
      where: { serviceId: id },
      _avg: { rating: true },
    }),
  ])
  if (!service) notFound()

  const { masterUrl, galleryUrls } = parseServiceImagesForSellerForm({
    images: service.images,
    galleryImages: service.galleryImages,
  })
  const displayImages = getServiceDisplayImageUrls({
    images: service.images,
    galleryImages: service.galleryImages,
  })

  const reviews = service.reviews.map((review) => {
    const safeName = (review.user?.name || "").trim()
    const reviewerName = safeName ? safeName.split(/\s+/)[0] : "Verified buyer"
    return {
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      images: extractImageUrls(review.images),
      createdAt: review.createdAt.toISOString(),
      isVerified: review.isVerified,
      reviewerName,
    }
  })

  return (
    <ServiceDetailClient
      service={{
        id: service.id,
        name: service.name,
        description: service.description,
        basePrice: service.basePrice,
        discount: service.discount,
        images: displayImages,
        masterImage: masterUrl,
        galleryImages: galleryUrls,
        serviceType: service.serviceType,
        duration: service.duration,
        serviceCategory: service.serviceCategory,
        seller: service.seller
          ? { store: service.seller.store ? { name: service.seller.store.name } : null }
          : null,
        _count: service._count,
        averageRating: Number(ratingAgg._avg.rating ?? 0),
        reviews,
      }}
    />
  )
}
