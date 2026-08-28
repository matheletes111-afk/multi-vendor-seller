import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { RiderForgotPasswordClient } from "./forgot-password-client"

export const metadata = {
  title: "Forgot Password | Rider Portal",
  description: "Reset your delivery rider account password.",
}

export default async function RiderForgotPasswordPage() {
  const session = await auth()
  if (session?.user?.role === "RIDER") {
    redirect("/riderapp")
  }

  return <RiderForgotPasswordClient />
}
