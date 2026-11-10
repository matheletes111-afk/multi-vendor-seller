import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isServiceSeller } from "@/lib/rbac"
import { ServiceNetWorthClient } from "./net-worth-client"

export const metadata = {
  title: "Revenue & Payout Desk | Service Dashboard",
  description: "View your credited revenue, track yet to pay balance, and request payouts.",
}

export default async function NetWorthPage() {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) redirect("/service-seller/login")

  return <ServiceNetWorthClient />
}
