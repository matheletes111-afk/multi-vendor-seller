"use server"

import { updateProduct } from "./update-product"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { isProductSeller } from "@/lib/rbac"

export async function updateProductForm(productId: string, formData: FormData) {
  // Check auth first before processing
  const session = await auth()
  
  if (!session?.user || !isProductSeller(session.user)) {
    redirect("/login?error=session_expired")
  }

  const imagesInput = formData.get("images") as string
  const images = imagesInput
    ? imagesInput.split("\n").map((url) => url.trim()).filter((url) => url.length > 0)
    : []

  const basePriceStr = formData.get("basePrice") as string
  const stockStr = formData.get("stock") as string

  // Validate required fields
  const name = formData.get("name") as string
  const categoryId = formData.get("categoryId") as string

  if (!name || !categoryId) {
    redirect(`/dashboard/seller/products/${productId}?error=missing_required_fields`)
  }

  // Parse basePrice and stock, handling empty strings
  let basePrice: number | undefined = undefined
  if (basePriceStr && basePriceStr.trim()) {
    const parsed = parseFloat(basePriceStr)
    if (!isNaN(parsed) && parsed > 0) {
      basePrice = parsed
    }
  }

  let stock: number | undefined = undefined
  if (stockStr && stockStr.trim()) {
    const parsed = parseInt(stockStr)
    if (!isNaN(parsed) && parsed >= 0) {
      stock = parsed
    }
  }

  // Parse isActive - checkbox sends "true" when checked, nothing when unchecked
  const isActiveInput = formData.get("isActive") as string
  const isActive = isActiveInput === "true"

  const data: any = {
    name,
    description: (formData.get("description") as string) || undefined,
    categoryId,
    sku: (formData.get("sku") as string) || undefined,
    isActive,
  }

  if (basePrice !== undefined) {
    data.basePrice = basePrice
  }

  if (stock !== undefined) {
    data.stock = stock
  }

  if (images.length > 0) {
    data.images = images
  }

  console.log("Product update form data:", data)

  const result = await updateProduct(productId, data)

  if (result.error) {
    const errorMsg = typeof result.error === "string"
      ? result.error
      : "Failed to update product"
    redirect(`/dashboard/seller/products/${productId}?error=${encodeURIComponent(errorMsg)}`)
  }

  redirect("/dashboard/seller/products?success=Product updated successfully")
}

