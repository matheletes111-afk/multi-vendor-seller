import { auth } from "@/lib/auth"
import { UserRole } from "@prisma/client"
import { redirect } from "next/navigation"
import { RestaurantSellerAdmanagementPageClient } from "./page-client"

export default async function RestaurantSellerAdmanagementPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== UserRole.SELLER_RESTAURANT) redirect("/restaurant-seller/login")
  return <RestaurantSellerAdmanagementPageClient />
}
