import { auth } from "@/lib/auth"
import { UserRole } from "@prisma/client"
import { redirect } from "next/navigation"
import { AdminRestaurantFoodsClient } from "./foods-client"

export default async function AdminFoodsPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    redirect("/admin/login") // or default admin login
  }
  return <AdminRestaurantFoodsClient />
}
