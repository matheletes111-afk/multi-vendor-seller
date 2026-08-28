import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { RiderOrdersClient } from "./orders-client"

export const metadata = {
  title: "Delivery Assignments | Rider Portal",
  description: "View and manage active and completed order deliveries.",
}

export default async function RiderOrdersPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== "RIDER") {
    redirect("/riderapp/login")
  }

  return <RiderOrdersClient />
}
