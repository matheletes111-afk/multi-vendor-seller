import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { RiderDashboardClient } from "./dashboard-client"

export const metadata = {
  title: "Rider Dashboard | MEEEM Delivery Network",
  description: "Manage your delivery schedule, active service zones, and view live order assignments.",
}

export default async function RiderDashboardPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== "RIDER") {
    redirect("/riderapp/login")
  }

  return <RiderDashboardClient user={session.user} />
}
