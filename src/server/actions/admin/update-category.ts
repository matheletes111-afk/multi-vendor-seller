"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { updateCategorySchema } from "@/server/validations/category"
import { isAdmin } from "@/lib/rbac"
import { revalidatePath } from "next/cache"

export async function updateCategory(categoryId: string, data: unknown) {
  const session = await auth()
  
  if (!session?.user || !isAdmin(session.user)) {
    return { error: "Unauthorized" }
  }

  // Verify category exists
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
  })

  if (!category) {
    return { error: "Category not found" }
  }

  const validated = updateCategorySchema.safeParse(data)
  if (!validated.success) {
    const errorMessages = validated.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
    console.error("Validation errors:", validated.error.errors)
    return { error: `Validation failed: ${errorMessages}`, details: validated.error.errors }
  }

  // Generate slug from name if name is being updated
  let updateData: any = { ...validated.data }
  if (validated.data.name && validated.data.name !== category.name) {
    const slug = validated.data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
    updateData.slug = slug
  }

  // Clean up undefined values
  Object.keys(updateData).forEach(key => {
    if (updateData[key] === undefined) {
      delete updateData[key]
    }
  })

  try {
    const updated = await prisma.category.update({
      where: { id: categoryId },
      data: updateData,
    })

    revalidatePath("/dashboard/admin/categories")
    return { success: true, category: updated }
  } catch (error: any) {
    console.error("Prisma error updating category:", error)
    if (error.code === "P2002") {
      return { error: "Category with this name already exists" }
    }
    return { error: `Failed to update category: ${error.message || "Unknown error"}` }
  }
}

