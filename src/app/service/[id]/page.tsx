import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { ServiceDetailClient } from "./service-detail-client"

export default async function ServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const service = await prisma.service.findUnique({
    where: { id, isActive: true },
    include: {
      serviceCategory: true,
      seller: { include: { store: true } },
      _count: { select: { reviews: true } },
    },
  })
  if (!service) notFound()

  return (
    <ServiceDetailClient
      service={{
        id: service.id,
        name: service.name,
        description: service.description,
        basePrice: service.basePrice,
        discount: service.discount,
        images: service.images,
        serviceCategory: service.serviceCategory,
        seller: service.seller
          ? { store: service.seller.store ? { name: service.seller.store.name } : null }
          : null,
        _count: service._count,
      }}
    />
  )
}
