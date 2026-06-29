import { auth } from "@/lib/auth"
import { UserRole } from "@prisma/client"
import { redirect } from "next/navigation"
import { EditFoodClient } from "./edit-food-client"

export default async function EditFoodPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== UserRole.SELLER_RESTAURANT) {
    redirect("/restaurant-seller/login")
  }
  const { id } = await params
  return <EditFoodClient id={id} />
}
