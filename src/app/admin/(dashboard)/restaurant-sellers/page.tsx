import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { RestaurantSellersClient } from "./restaurant-sellers-client"

export default async function AdminRestaurantSellersPage() {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }
  return <RestaurantSellersClient />
}
