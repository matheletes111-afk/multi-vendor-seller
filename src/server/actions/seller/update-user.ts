"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isSeller } from "@/lib/rbac"
import { revalidatePath } from "next/cache"

export async function updateUser(data: {
  name?: string
  image?: string
}) {
  const session = await auth()
  
  if (!session?.user || !isSeller(session.user)) {
    return { error: "Unauthorized" }
  }

  try {
    // Clean up undefined values
    const updateData: any = {}
    if (data.name !== undefined && data.name !== null && data.name !== "") {
      updateData.name = data.name
    }
    if (data.image !== undefined && data.image !== null && data.image !== "") {
      updateData.image = data.image
    }

    if (Object.keys(updateData).length === 0) {
      return { error: "No data to update" }
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
    })

    revalidatePath("/dashboard/seller/settings")
    return { success: true, user: updated }
  } catch (error: any) {
    console.error("Prisma error updating user:", error)
    return { error: `Failed to update user: ${error.message || "Unknown error"}` }
  }
}

