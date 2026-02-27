import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { UserRole } from "@prisma/client"

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  switch (session.user.role) {
    case UserRole.ADMIN:
      redirect("/admin")
    case UserRole.SELLER_PRODUCT:
      redirect("/product-seller")
    case UserRole.SELLER_SERVICE:
      redirect("/service-seller")
    case UserRole.CUSTOMER:
      redirect("/customer")
    default:
      redirect("/")
  }
}
