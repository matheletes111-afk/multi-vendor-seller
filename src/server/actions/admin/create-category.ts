"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createCategorySchema } from "@/server/validations/category"
import { isAdmin } from "@/lib/rbac"
import { revalidatePath } from "next/cache"

export async function createCategory(data: unknown) {
  const session = await auth()
  
  if (!session?.user || !isAdmin(session.user)) {
    return { error: "Unauthorized" }
  }

  const validated = createCategorySchema.safeParse(data)
  if (!validated.success) {
    const errorMessages = validated.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
    console.error("Validation errors:", validated.error.errors)
    return { error: `Validation failed: ${errorMessages}`, details: validated.error.errors }
  }

  // Generate slug from name
  const slug = validated.data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

  try {
    const category = await prisma.category.create({
      data: {
        name: validated.data.name,
        slug,
        description: validated.data.description || null,
        image: validated.data.image || null,
        commissionRate: validated.data.commissionRate,
        isActive: validated.data.isActive,
      },
    })

    revalidatePath("/dashboard/admin/categories")
    return { success: true, category }
  } catch (error: any) {
    console.error("Prisma error creating category:", error)
    if (error.code === "P2002") {
      return { error: "Category with this name already exists" }
    }
    return { error: `Failed to create category: ${error.message || "Unknown error"}` }
  }
}

