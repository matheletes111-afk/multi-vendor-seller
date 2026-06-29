import { auth } from "@/lib/auth"
import { UserRole } from "@prisma/client"
import { redirect } from "next/navigation"
import { NewFoodClient } from "./new-food-client"

export default async function NewFoodPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== UserRole.SELLER_RESTAURANT) {
    redirect("/restaurant-seller/login")
  }
  return <NewFoodClient />
}
