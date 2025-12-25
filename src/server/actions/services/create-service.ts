"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkServiceLimit } from "@/lib/subscriptions"
import { createServiceSchema } from "@/server/validations/service"
import { isServiceSeller } from "@/lib/rbac"
import { revalidatePath } from "next/cache"

export async function createService(data: unknown) {
  const session = await auth()
  
  if (!session?.user || !isServiceSeller(session.user)) {
    return { error: "Unauthorized" }
  }

  const validated = createServiceSchema.safeParse(data)
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
  const limitCheck = await checkServiceLimit(seller.id)
  if (!limitCheck.allowed) {
    return { 
      error: "Service limit reached", 
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
    const service = await prisma.service.create({
      data: {
        sellerId: seller.id,
        categoryId: validated.data.categoryId,
        name: validated.data.name,
        slug,
        description: validated.data.description,
        serviceType: validated.data.serviceType,
        basePrice: validated.data.basePrice,
        duration: validated.data.duration,
        images: validated.data.images || [],
      },
    })

    revalidatePath("/dashboard/seller/services")
    return { success: true, service }
  } catch (error: any) {
    if (error.code === "P2002") {
      return { error: "Service with this name already exists" }
    }
    return { error: "Failed to create service" }
  }
}

