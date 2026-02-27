import { auth } from "@/lib/auth"
import { isServiceSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { ServiceSellerAdmanagementPageClient } from "./page-client"

export default async function ServiceSellerAdmanagementPage() {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) redirect("/login")
  return <ServiceSellerAdmanagementPageClient />
}
