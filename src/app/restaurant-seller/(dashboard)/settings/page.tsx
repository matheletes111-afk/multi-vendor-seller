import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import RestaurantSettingsClient from "./settings-client"
import { UserRole } from "@prisma/client"

export default async function RestaurantSellerSettingsPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== UserRole.SELLER_RESTAURANT) redirect("/restaurant-seller/login")
  return <RestaurantSettingsClient />
}
