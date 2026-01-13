"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isSeller } from "@/lib/rbac"
import { revalidatePath } from "next/cache"

export async function updateStore(data: {
  name?: string
  description?: string
  phone?: string
  website?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
  logo?: string
  banner?: string
}) {
  const session = await auth()
  
  if (!session?.user || !isSeller(session.user)) {
    return { error: "Unauthorized" }
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    include: { store: true },
  })

  if (!seller) {
    return { error: "Seller not found" }
  }

  try {
    // Clean up undefined values
    const updateData: any = {}
    Object.keys(data).forEach(key => {
      const value = data[key as keyof typeof data]
      if (value !== undefined && value !== null && value !== "") {
        updateData[key] = value
      }
    })

    if (Object.keys(updateData).length === 0) {
      return { error: "No data to update" }
    }

    // Update or create store
    if (seller.store) {
      const updated = await prisma.store.update({
        where: { id: seller.store.id },
        data: updateData,
      })
      revalidatePath("/dashboard/seller/settings")
      return { success: true, store: updated }
    } else {
      const created = await prisma.store.create({
        data: {
          sellerId: seller.id,
          name: updateData.name || "My Store",
          ...updateData,
        },
      })
      revalidatePath("/dashboard/seller/settings")
      return { success: true, store: created }
    }
  } catch (error: any) {
    console.error("Prisma error updating store:", error)
    return { error: `Failed to update store: ${error.message || "Unknown error"}` }
  }
}

