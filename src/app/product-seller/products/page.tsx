import { auth } from "@/lib/auth"
import { isProductSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { ProductsPageClient } from "./page-client"

export default async function ProductsPage() {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    redirect("/login")
  }
  return <ProductsPageClient />
}
