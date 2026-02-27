import { auth } from "@/lib/auth"
import { isServiceSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { ServiceOrdersClient } from "./orders-client"

export default async function ServiceSellerOrdersPage() {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) redirect("/login")
  return <ServiceOrdersClient />
}
