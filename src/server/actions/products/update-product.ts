"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { updateProductSchema } from "@/server/validations/product"
import { isProductSeller } from "@/lib/rbac"
import { revalidatePath } from "next/cache"

export async function updateProduct(productId: string, data: unknown) {
  const session = await auth()
  
  if (!session?.user || !isProductSeller(session.user)) {
    return { error: "Unauthorized" }
  }

  const validated = updateProductSchema.safeParse(data)
  if (!validated.success) {
    return { error: "Invalid data", details: validated.error.errors }
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller) {
    return { error: "Seller not found" }
  }

  // Verify product belongs to seller
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      sellerId: seller.id,
    },
  })

  if (!product) {
    return { error: "Product not found" }
  }

  try {
    const updated = await prisma.product.update({
      where: { id: productId },
      data: validated.data,
    })

    revalidatePath("/dashboard/seller/products")
    return { success: true, product: updated }
  } catch (error) {
    return { error: "Failed to update product" }
  }
}

