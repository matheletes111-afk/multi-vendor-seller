import { auth } from "@/lib/auth"
import { isCustomer } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { CustomerAddressesClient } from "./addresses-client"

export default async function CustomerAddressesPage() {
  const session = await auth()
  if (!session?.user || !isCustomer(session.user)) redirect("/customer/login")
  return <CustomerAddressesClient />
}
