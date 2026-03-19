import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { ServiceBookClient } from "./service-book-client"

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function ServiceBookPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  const params = await searchParams
  const serviceId = typeof params.serviceId === "string" ? params.serviceId : null
  const slotStartTime = typeof params.slotStartTime === "string" ? params.slotStartTime : null
  const slotEndTime = typeof params.slotEndTime === "string" ? params.slotEndTime : null

  if (!session?.user?.id) {
    const q = new URLSearchParams()
    if (serviceId) q.set("serviceId", serviceId)
    if (slotStartTime) q.set("slotStartTime", slotStartTime)
    if (slotEndTime) q.set("slotEndTime", slotEndTime)
    redirect("/customer/login?callbackUrl=" + encodeURIComponent("/service-book?" + q.toString()))
  }
  if (session.user.role !== UserRole.CUSTOMER) {
    redirect("/")
  }
  if (!serviceId) {
    redirect("/")
  }
  const service = await prisma.service.findUnique({
    where: { id: serviceId, isActive: true },
    select: { id: true, name: true, basePrice: true, discount: true },
  })
  if (!service) {
    redirect("/")
  }
  const displayPrice = service.basePrice != null ? Math.max(0, service.basePrice - service.discount) : null
  return (
    <ServiceBookClient
      serviceId={service.id}
      serviceName={service.name}
      displayPrice={displayPrice}
      slotStartTime={slotStartTime}
      slotEndTime={slotEndTime}
    />
  )
}
