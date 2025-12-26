"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function deleteProduct(productId: string) {
  const session = await auth()
  
  if (!session?.user || !isProductSeller(session.user)) {
    redirect("/dashboard/seller/products?error=unauthorized")
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller) {
    redirect("/dashboard/seller/products?error=seller_not_found")
  }

  // Verify product belongs to seller
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      sellerId: seller.id,
    },
  })

  if (!product) {
    redirect("/dashboard/seller/products?error=product_not_found")
  }

  try {
    // Soft delete
    await prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
    })

    revalidatePath("/dashboard/seller/products")
    redirect("/dashboard/seller/products?success=deleted")
  } catch (error) {
    redirect("/dashboard/seller/products?error=delete_failed")
  }
}

