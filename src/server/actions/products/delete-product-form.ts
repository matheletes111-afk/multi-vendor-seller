"use server"

import { deleteProduct } from "./delete-product"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { isProductSeller } from "@/lib/rbac"

export async function deleteProductForm(productId: string) {
  const session = await auth()
  
  if (!session?.user || !isProductSeller(session.user)) {
    redirect("/login?error=session_expired")
  }

  const result = await deleteProduct(productId)

  if (result.error) {
    const errorMsg = typeof result.error === "string"
      ? result.error
      : "Failed to delete product"
    redirect(`/dashboard/seller/products?error=${encodeURIComponent(errorMsg)}`)
  }

  redirect("/dashboard/seller/products?success=Product deleted permanently")
}

