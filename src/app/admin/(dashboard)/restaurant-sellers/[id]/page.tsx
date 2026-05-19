import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { RestaurantSellerDetailClient } from "./restaurant-seller-detail-client"

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

  // Serialize to plain object for client component
  const plainSeller = JSON.parse(JSON.stringify(seller))

  return <RestaurantSellerDetailClient seller={plainSeller} />
}
