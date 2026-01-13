"use server"

import { updateCategory } from "./update-category"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"

export async function updateCategoryForm(categoryId: string, formData: FormData) {
  // Check auth first before processing
  const session = await auth()
  
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/login?error=session_expired")
  }

  const name = formData.get("name") as string
  const description = formData.get("description") as string
  const image = formData.get("image") as string
  const commissionRateInput = formData.get("commissionRate") as string
  const isActiveInput = formData.get("isActive") as string

  if (!name) {
    redirect(`/dashboard/admin/categories?error=name_required`)
  }

  // Parse commissionRate
  let commissionRate: number | undefined = undefined
  if (commissionRateInput && commissionRateInput.trim()) {
    const parsed = parseFloat(commissionRateInput)
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      commissionRate = parsed
    }
  }

  // Parse isActive - checkbox sends "true" when checked, nothing when unchecked
  const isActive = isActiveInput === "true"

  const data: any = {
    name,
    description: description || undefined,
    image: image || undefined,
    isActive,
  }

  if (commissionRate !== undefined) {
    data.commissionRate = commissionRate
  }

  console.log("Category update form data:", data)

  const result = await updateCategory(categoryId, data)

  if (result.error) {
    const errorMsg = typeof result.error === "string"
      ? result.error
      : "Failed to update category"
    redirect(`/dashboard/admin/categories?error=${encodeURIComponent(errorMsg)}`)
  }

  redirect("/dashboard/admin/categories?success=Category updated successfully")
}

