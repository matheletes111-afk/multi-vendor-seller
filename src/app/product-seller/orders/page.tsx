import { auth } from "@/lib/auth"
import { isProductSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { OrdersClient } from "./orders-client"

export default async function ProductSellerOrdersPage() {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    redirect("/login")
  }
  return <OrdersClient />
}
