"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkProductLimit } from "@/lib/subscriptions"
import { createProductSchema } from "@/server/validations/product"
import { isProductSeller } from "@/lib/rbac"
import { revalidatePath } from "next/cache"

export async function createProduct(data: unknown) {
  const session = await auth()
  
  if (!session?.user || !isProductSeller(session.user)) {
    return { error: "Unauthorized" }
  }

  const validated = createProductSchema.safeParse(data)
  if (!validated.success) {
    const errorMessages = validated.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
    console.error("Validation errors:", validated.error.errors)
    return { error: `Validation failed: ${errorMessages}`, details: validated.error.errors }
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller) {
    return { error: "Seller not found. Please complete your seller registration." }
  }

  if (!seller.isApproved) {
    return { error: "Your seller account is pending approval. Please wait for admin approval." }
  }

  if (seller.isSuspended) {
    return { error: "Your seller account has been suspended. Please contact support." }
  }

  // Check subscription limits
  const limitCheck = await checkProductLimit(seller.id)
  if (!limitCheck.allowed) {
    const limitMsg = limitCheck.limit === null 
      ? "unlimited" 
      : limitCheck.limit.toString()
    return { 
      error: `Product limit reached. You have ${limitCheck.current} products and your plan allows ${limitMsg}. Please upgrade your subscription to add more products.`, 
      current: limitCheck.current,
      limit: limitCheck.limit,
    }
  }

  // Generate slug
  const slug = validated.data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

  try {
    // Ensure images is an array for JSON storage
    const imagesData = validated.data.images && Array.isArray(validated.data.images) 
      ? validated.data.images 
      : []

    const discount = Math.round((validated.data.discount ?? 0) * 100) / 100

    const product = await prisma.product.create({
      data: {
        sellerId: seller.id,
        categoryId: validated.data.categoryId,
        name: validated.data.name,
        slug,
        description: validated.data.description,
        basePrice: validated.data.basePrice,
        discount,
        hasGst: validated.data.hasGst ?? true,
        stock: validated.data.stock,
        sku: validated.data.sku,
        images: imagesData as any,
      },
    })

    revalidatePath("/dashboard/seller/products")
    return { success: true, product }
  } catch (error: any) {
    console.error("Prisma error creating product:", error)
    if (error.code === "P2002") {
      return { error: "Product with this name already exists" }
    }
    return { error: `Failed to create product: ${error.message || "Unknown error"}` }
  }
}

