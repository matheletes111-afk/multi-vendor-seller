"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isSeller } from "@/lib/rbac"

export async function getCurrentSubscription() {
  const session = await auth()
  
  if (!session?.user || !isSeller(session.user)) {
    return null
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    include: {
      subscription: {
        include: {
          plan: true,
        },
      },
    },
  })

  return seller?.subscription || null
}

