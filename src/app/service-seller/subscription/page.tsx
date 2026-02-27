import { auth } from "@/lib/auth"
import { isServiceSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { ServiceSubscriptionClient } from "./subscription-client"

export default async function ServiceSellerSubscriptionPage() {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) redirect("/login")
  return <ServiceSubscriptionClient />
}
