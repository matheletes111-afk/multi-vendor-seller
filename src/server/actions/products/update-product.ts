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
    let updateData: any = { ...validated.data }
    if (validated.data.name && validated.data.name !== product.name) {
      const slug = validated.data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
      updateData.slug = slug
    }

    const discount = validated.data.discount !== undefined
      ? Math.round(validated.data.discount * 100) / 100
      : product.discount
    updateData.discount = discount
    updateData.hasGst = validated.data.hasGst ?? product.hasGst
    if (validated.data.basePrice !== undefined) updateData.basePrice = validated.data.basePrice

    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key]
      }
    })

    const updated = await prisma.product.update({
      where: { id: productId },
      data: updateData,
    })

    revalidatePath("/dashboard/seller/products")
    return { success: true, product: updated }
  } catch (error: any) {
    console.error("Prisma error updating product:", error)
    if (error.code === "P2002") {
      return { error: "Product with this name already exists" }
    }
    return { error: `Failed to update product: ${error.message || "Unknown error"}` }
  }
}

