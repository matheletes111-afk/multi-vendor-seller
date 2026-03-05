import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { AdminSellerAdsPageClient } from "./page-client"

export default async function AdminSellerAdsPage() {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }
  return <AdminSellerAdsPageClient />
}
