"use server"

import { deleteCategory } from "./delete-category"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"

export async function deleteCategoryForm(categoryId: string) {
  // Check auth first before processing
  const session = await auth()
  
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/login?error=session_expired")
  }

  const result = await deleteCategory(categoryId)

  if (result.error) {
    const errorMsg = typeof result.error === "string"
      ? result.error
      : "Failed to delete category"
    redirect(`/dashboard/admin/categories?error=${encodeURIComponent(errorMsg)}`)
  }

  redirect("/dashboard/admin/categories?success=Category deleted successfully")
}

