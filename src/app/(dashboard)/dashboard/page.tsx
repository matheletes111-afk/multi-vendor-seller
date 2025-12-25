import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { UserRole } from "@prisma/client"

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  // Redirect based on role
  switch (session.user.role) {
    case UserRole.ADMIN:
      redirect("/dashboard/admin")
    case UserRole.SELLER_PRODUCT:
    case UserRole.SELLER_SERVICE:
      redirect("/dashboard/seller")
    case UserRole.CUSTOMER:
      redirect("/dashboard/customer")
    default:
      redirect("/")
  }
}

