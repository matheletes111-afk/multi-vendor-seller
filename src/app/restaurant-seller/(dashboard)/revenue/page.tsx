import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isRestaurantSeller } from "@/lib/rbac"
import { RestaurantRevenueClient } from "./revenue-client"

export const metadata = {
  title: "My Revenue | Restaurant Dashboard",
  description: "Monitor settled earnings, food order payouts, and net balance.",
}

export default async function RestaurantRevenuePage() {
  const session = await auth()
  if (!session?.user || !isRestaurantSeller(session.user)) redirect("/restaurant-seller/login")

  return <RestaurantRevenueClient />
}
