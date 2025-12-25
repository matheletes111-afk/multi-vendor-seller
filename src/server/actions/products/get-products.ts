"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"

export async function getSellerProducts() {
  const session = await auth()
  
  if (!session?.user || !isProductSeller(session.user)) {
    return []
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller) {
    return []
  }

  return await prisma.product.findMany({
    where: { sellerId: seller.id },
    include: {
      category: true,
      variants: true,
      _count: {
        select: {
          orderItems: true,
          reviews: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })
}

