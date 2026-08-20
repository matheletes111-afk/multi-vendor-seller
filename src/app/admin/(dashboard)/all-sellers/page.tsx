import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { AllSellersClient } from "./all-sellers-client"

export const metadata = {
  title: "All Sellers Master | Admin Portal",
  description: "Unified master seller directory and bulk management across Product, Service, Hotel, and Restaurant sellers.",
}

export default async function AdminAllSellersPage() {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }

  return <AllSellersClient />
}
