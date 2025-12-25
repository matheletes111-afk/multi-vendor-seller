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
    return { error: "Invalid data", details: validated.error.errors }
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller) {
    return { error: "Seller not found" }
  }

  // Check subscription limits
  const limitCheck = await checkProductLimit(seller.id)
  if (!limitCheck.allowed) {
    return { 
      error: "Product limit reached", 
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
    const product = await prisma.product.create({
      data: {
        sellerId: seller.id,
        categoryId: validated.data.categoryId,
        name: validated.data.name,
        slug,
        description: validated.data.description,
        basePrice: validated.data.basePrice,
        stock: validated.data.stock,
        sku: validated.data.sku,
        images: validated.data.images || [],
      },
    })

    revalidatePath("/dashboard/seller/products")
    return { success: true, product }
  } catch (error: any) {
    if (error.code === "P2002") {
      return { error: "Product with this name already exists" }
    }
    return { error: "Failed to create product" }
  }
}

