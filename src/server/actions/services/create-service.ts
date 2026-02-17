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
    const errorMessages = validated.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
    console.error("Validation errors:", validated.error.errors)
    return { error: `Validation failed: ${errorMessages}`, details: validated.error.errors }
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller) {
    return { error: "Seller not found. Please complete your seller registration." }
  }

  if (!seller.isApproved) {
    return { error: "Your seller account is pending approval. Please wait for admin approval." }
  }

  if (seller.isSuspended) {
    return { error: "Your seller account has been suspended. Please contact support." }
  }

  // Check subscription limits
  const limitCheck = await checkServiceLimit(seller.id)
  if (!limitCheck.allowed) {
    const limitMsg = limitCheck.limit === null 
      ? "unlimited" 
      : limitCheck.limit.toString()
    return { 
      error: `Service limit reached. You have ${limitCheck.current} services and your plan allows ${limitMsg}. Please upgrade your subscription to add more services.`, 
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
    // Ensure images is an array for JSON storage
    const imagesData = validated.data.images && Array.isArray(validated.data.images) 
      ? validated.data.images 
      : []

    const basePrice = validated.data.basePrice ?? null
    const discount = Math.round((validated.data.discount ?? 0) * 100) / 100

    const service = await prisma.service.create({
      data: {
        sellerId: seller.id,
        categoryId: validated.data.categoryId,
        name: validated.data.name,
        slug,
        description: validated.data.description,
        serviceType: validated.data.serviceType,
        basePrice,
        discount,
        hasGst: validated.data.hasGst ?? true,
        duration: validated.data.duration,
        images: imagesData as any,
      },
    })

    revalidatePath("/dashboard/seller/services")
    return { success: true, service }
  } catch (error: any) {
    console.error("Prisma error creating service:", error)
    if (error.code === "P2002") {
      return { error: "Service with this name already exists" }
    }
    return { error: `Failed to create service: ${error.message || "Unknown error"}` }
  }
}

