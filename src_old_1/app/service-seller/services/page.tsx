import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isServiceSeller } from "@/lib/rbac"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { ServicesPageClient } from "./page-client"

async function getSellerServices() {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) return []
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } })
  if (!seller) return []
  return prisma.service.findMany({
    where: { sellerId: seller.id },
    include: { category: true, slots: true, packages: true, _count: { select: { orderItems: true, reviews: true } } },
    orderBy: { createdAt: "desc" },
  })
}

async function deleteService(serviceId: string) {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) return { error: "Unauthorized" }
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } })
  if (!seller) return { error: "Seller not found" }
  const service = await prisma.service.findUnique({ where: { id: serviceId } })
  if (!service || service.sellerId !== seller.id) return { error: "Service not found" }
  try {
    await prisma.service.delete({ where: { id: serviceId } })
    revalidatePath("/service-seller/services")
    return { success: true }
  } catch (error: any) {
    return { error: `Delete failed: ${error?.message || "Unknown error"}` }
  }
}

async function deleteServiceForm(serviceId: string) {
  "use server"
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) redirect("/login?error=session_expired")
  const result = await deleteService(serviceId)
  if (result.error) redirect(`/service-seller/services?error=${encodeURIComponent(typeof result.error === "string" ? result.error : "Failed")}`)
  redirect("/service-seller/services?success=Service deleted permanently")
}

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const services = await getSellerServices()
  const params = await searchParams

  return (
    <ServicesPageClient
      services={services}
      params={params}
      deleteServiceForm={deleteServiceForm}
    />
  )
}
