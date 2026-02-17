"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { updateServiceSchema } from "@/server/validations/service"
import { isServiceSeller } from "@/lib/rbac"
import { revalidatePath } from "next/cache"

export async function updateService(serviceId: string, data: unknown) {
  const session = await auth()
  
  if (!session?.user || !isServiceSeller(session.user)) {
    return { error: "Unauthorized" }
  }

  // Verify service exists and belongs to seller
  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller) {
    return { error: "Seller not found" }
  }

  const service = await prisma.service.findFirst({
    where: {
      id: serviceId,
      sellerId: seller.id,
    },
  })

  if (!service) {
    return { error: "Service not found" }
  }

  const validated = updateServiceSchema.safeParse(data)
  if (!validated.success) {
    const errorMessages = validated.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
    console.error("Validation errors:", validated.error.errors)
    return { error: `Validation failed: ${errorMessages}`, details: validated.error.errors }
  }

  let updateData: any = { ...validated.data }
  if (validated.data.name && validated.data.name !== service.name) {
    const slug = validated.data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
    updateData.slug = slug
  }

  const discount = validated.data.discount !== undefined
    ? Math.round(validated.data.discount * 100) / 100
    : service.discount
  updateData.discount = discount
  updateData.hasGst = validated.data.hasGst ?? service.hasGst
  if (validated.data.basePrice !== undefined) updateData.basePrice = validated.data.basePrice

  Object.keys(updateData).forEach(key => {
    if (updateData[key] === undefined) {
      delete updateData[key]
    }
  })

  try {
    if (updateData.images !== undefined) {
      updateData.images = Array.isArray(updateData.images) ? updateData.images : []
    }

    const updated = await prisma.service.update({
      where: { id: serviceId },
      data: updateData,
    })

    revalidatePath("/dashboard/seller/services")
    return { success: true, service: updated }
  } catch (error: any) {
    console.error("Prisma error updating service:", error)
    if (error.code === "P2002") {
      return { error: "Service with this name already exists" }
    }
    return { error: `Failed to update service: ${error.message || "Unknown error"}` }
  }
}

