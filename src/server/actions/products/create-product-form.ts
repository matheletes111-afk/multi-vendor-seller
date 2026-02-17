"use server"

import { createProduct } from "./create-product"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { isProductSeller } from "@/lib/rbac"

export async function createProductForm(formData: FormData) {
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
  const discountStr = (formData.get("discount") as string) || "0"
  const hasGstInput = formData.get("hasGst") as string

  // Validate required fields
  const name = formData.get("name") as string
  const categoryId = formData.get("categoryId") as string

  if (!name || !categoryId) {
    redirect("/dashboard/seller/products/new?error=missing_required_fields")
  }

  if (!basePriceStr || isNaN(parseFloat(basePriceStr))) {
    redirect("/dashboard/seller/products/new?error=invalid_price")
  }

  if (!stockStr || isNaN(parseInt(stockStr))) {
    redirect("/dashboard/seller/products/new?error=invalid_stock")
  }

  const discount = Math.max(0, isNaN(parseFloat(discountStr)) ? 0 : parseFloat(discountStr))
  const hasGst = hasGstInput === "true"

  const data = {
    name,
    description: formData.get("description") as string || undefined,
    categoryId,
    basePrice: parseFloat(basePriceStr),
    hasGst,
    discount,
    stock: parseInt(stockStr),
    sku: formData.get("sku") as string || undefined,
    images: images.length > 0 ? images : undefined,
  }

  const result = await createProduct(data)

  if (result.error) {
    const errorMsg = typeof result.error === "string" ? result.error : "Failed to create product"
    console.error("Product creation error:", result.error)
    redirect(`/dashboard/seller/products/new?error=${encodeURIComponent(errorMsg)}`)
  }

  console.log("Product created successfully:", result.product?.id)
  redirect("/dashboard/seller/products?success=created")
}

