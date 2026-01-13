"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { revalidatePath } from "next/cache"

export async function deleteCategory(categoryId: string) {
  const session = await auth()
  
  if (!session?.user || !isAdmin(session.user)) {
    return { error: "Unauthorized" }
  }

  // Verify category exists
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: {
      _count: {
        select: {
          products: true,
          services: true,
        },
      },
    },
  })

  if (!category) {
    return { error: "Category not found" }
  }

  // Check if category is being used by products or services
  if (category._count.products > 0 || category._count.services > 0) {
    const productCount = category._count.products
    const serviceCount = category._count.services
    let errorMessage = "Cannot delete category. It is currently being used by "
    const parts: string[] = []
    
    if (productCount > 0) {
      parts.push(`${productCount} product${productCount > 1 ? 's' : ''}`)
    }
    if (serviceCount > 0) {
      parts.push(`${serviceCount} service${serviceCount > 1 ? 's' : ''}`)
    }
    
    errorMessage += parts.join(" and ")
    return { error: errorMessage }
  }

  try {
    await prisma.category.delete({
      where: { id: categoryId },
    })

    revalidatePath("/dashboard/admin/categories")
    return { success: true }
  } catch (error: any) {
    console.error("Prisma error deleting category:", error)
    return { error: `Failed to delete category: ${error.message || "Unknown error"}` }
  }
}

