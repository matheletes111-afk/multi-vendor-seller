import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { RestaurantOrdersClient } from "./orders-client"

export default async function RestaurantOrdersPage() {
  const session = await auth()
  if (!session || !session.user || session.user.role !== "SELLER_RESTAURANT") {
    redirect("/restaurant-seller/login")
  }

  const seller = await prisma.restaurantSeller.findUnique({
    where: { userId: session.user.id }
  })
  if (!seller) {
    redirect("/restaurant-seller/onboarding")
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <RestaurantOrdersClient />
    </div>
  )
}
