"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import { revalidatePath } from "next/cache"

export async function deleteProduct(productId: string) {
  const session = await auth()
  
  if (!session?.user || !isProductSeller(session.user)) {
    return { error: "Unauthorized" }
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
    // Soft delete
    await prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
    })

    revalidatePath("/dashboard/seller/products")
    return { success: true }
  } catch (error) {
    return { error: "Failed to delete product" }
  }
}

