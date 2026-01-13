"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isServiceSeller } from "@/lib/rbac"
import { revalidatePath } from "next/cache"

export async function deleteService(serviceId: string) {
  const session = await auth()
  
  if (!session?.user || !isServiceSeller(session.user)) {
    return { error: "Unauthorized" }
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller) {
    return { error: "Seller not found" }
  }

  // Verify service belongs to seller
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: {
      _count: {
        select: {
          orderItems: true,
          slots: true,
          packages: true,
        },
      },
    },
  })

  if (!service) {
    return { error: "Service not found" }
  }

  // Verify service belongs to seller
  if (service.sellerId !== seller.id) {
    return { error: "Unauthorized" }
  }

  try {
    // Hard delete - Prisma will cascade delete slots and packages automatically
    // OrderItems, Reviews, and CartItems have optional serviceId, so they won't block deletion
    await prisma.service.delete({
      where: { id: serviceId },
    })

    revalidatePath("/dashboard/seller/services")
    return { success: true }
  } catch (error: any) {
    console.error("Error deleting service:", error)
    const errorMessage = error?.message || "Unknown error"
    const errorCode = error?.code || "UNKNOWN"
    return { error: `Delete failed: ${errorMessage} (${errorCode})` }
  }
}

