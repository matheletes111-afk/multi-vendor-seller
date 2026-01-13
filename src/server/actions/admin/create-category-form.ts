"use server"

import { createCategory } from "./create-category"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"

export async function createCategoryForm(formData: FormData) {
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
    redirect("/dashboard/admin/categories?error=name_required")
  }

  // Parse commissionRate
  let commissionRate = 10.0
  if (commissionRateInput && commissionRateInput.trim()) {
    const parsed = parseFloat(commissionRateInput)
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      commissionRate = parsed
    }
  }

  // Parse isActive - checkbox sends "true" when checked, nothing when unchecked
  const isActive = isActiveInput === "true"

  const data = {
    name,
    description: description || undefined,
    image: image || undefined,
    commissionRate,
    isActive,
  }

  console.log("Category form data:", data)

  const result = await createCategory(data)

  if (result.error) {
    const errorMsg = typeof result.error === "string"
      ? result.error
      : "Failed to create category"
    redirect(`/dashboard/admin/categories?error=${encodeURIComponent(errorMsg)}`)
  }

  redirect("/dashboard/admin/categories?success=Category created successfully")
}

