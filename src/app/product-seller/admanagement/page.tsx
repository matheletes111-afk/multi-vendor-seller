import { auth } from "@/lib/auth"
import { isProductSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { ProductSellerAdmanagementPageClient } from "./page-client"

export default async function ProductSellerAdmanagementPage() {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) redirect("/login")
  return <ProductSellerAdmanagementPageClient />
}
