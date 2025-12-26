"use server"

import { updatePlan } from "./update-plan"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"

export async function updatePlanForm(planId: string, formData: FormData) {
  const session = await auth()
  
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard/admin/subscriptions?error=unauthorized")
  }

  const maxProductsStr = formData.get("maxProducts") as string
  const maxOrdersStr = formData.get("maxOrders") as string
  const priceStr = formData.get("price") as string

  const data: any = {
    displayName: formData.get("displayName") as string,
    description: formData.get("description") as string || undefined,
  }

  if (priceStr) {
    const price = parseFloat(priceStr)
    if (!isNaN(price)) {
      data.price = price
    }
  }

  if (maxProductsStr === "unlimited" || maxProductsStr === "") {
    data.maxProducts = null
  } else if (maxProductsStr) {
    const maxProducts = parseInt(maxProductsStr)
    if (!isNaN(maxProducts)) {
      data.maxProducts = maxProducts
    }
  }

  if (maxOrdersStr === "unlimited" || maxOrdersStr === "") {
    data.maxOrders = null
  } else if (maxOrdersStr) {
    const maxOrders = parseInt(maxOrdersStr)
    if (!isNaN(maxOrders)) {
      data.maxOrders = maxOrders
    }
  }

  const result = await updatePlan(planId, data)

  if (result.error) {
    redirect(`/dashboard/admin/subscriptions/edit/${planId}?error=${encodeURIComponent(result.error)}`)
  }

  redirect("/dashboard/admin/subscriptions?success=updated")
}

