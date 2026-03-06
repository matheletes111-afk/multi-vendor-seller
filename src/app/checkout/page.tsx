import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { UserRole } from "@prisma/client"
import { CheckoutClient } from "./checkout-client"

export default async function CheckoutPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/customer/login?callbackUrl=" + encodeURIComponent("/checkout"))
  }
  if (session.user.role !== UserRole.CUSTOMER) {
    redirect("/")
  }
  return <CheckoutClient />
}
