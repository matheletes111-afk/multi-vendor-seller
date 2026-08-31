import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { RiderRevenueClient } from "./revenue-client"

export const metadata = {
  title: "My Revenue & Earnings | Rider Portal",
  description: "Track your delivery earnings, in-progress drops, and completed order payouts.",
}

export default async function RiderRevenuePage() {
  const session = await auth()
  if (!session?.user || session.user.role !== "RIDER") {
    redirect("/riderapp/login")
  }

  return <RiderRevenueClient />
}
