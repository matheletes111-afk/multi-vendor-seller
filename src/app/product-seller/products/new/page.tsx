import { auth } from "@/lib/auth"
import { isProductSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { NewProductClient } from "./new-product-client"

export default async function NewProductPage() {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    redirect("/login")
  }
  return <NewProductClient />
}
