import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { RiderRegistrationClient } from "./registration-client"

export const metadata = {
  title: "Become a Delivery Rider | MEEEM Marketplace",
  description: "Register as a delivery rider with MEEEM and start delivering orders in your local zones.",
}

export default async function RiderRegistrationPage() {
  const session = await auth()
  if (session?.user?.role === "RIDER") {
    redirect("/riderapp")
  }

  return <RiderRegistrationClient />
}
