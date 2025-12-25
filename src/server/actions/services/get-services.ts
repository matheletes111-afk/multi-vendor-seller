"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isServiceSeller } from "@/lib/rbac"

export async function getSellerServices() {
  const session = await auth()
  
  if (!session?.user || !isServiceSeller(session.user)) {
    return []
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller) {
    return []
  }

  return await prisma.service.findMany({
    where: { sellerId: seller.id },
    include: {
      category: true,
      slots: true,
      packages: true,
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

