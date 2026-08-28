import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { RiderLoginClient } from "./login-client"

export const metadata = {
  title: "Rider Login | MEEEM Delivery Network",
  description: "Sign in to your MEEEM Delivery Rider account to manage your delivery areas and orders.",
}

export default async function RiderLoginPage() {
  const session = await auth()
  if (session?.user?.role === "RIDER") {
    redirect("/riderapp")
  }

  return <RiderLoginClient />
}
