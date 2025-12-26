"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function updatePlan(planId: string, data: {
  displayName?: string
  description?: string
  price?: number
  maxProducts?: number | null
  maxOrders?: number | null
  features?: any
}) {
  const session = await auth()
  
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard/admin/subscriptions?error=unauthorized")
  }

  try {
    const plan = await prisma.plan.update({
      where: { id: planId },
      data: {
        displayName: data.displayName,
        description: data.description,
        price: data.price,
        maxProducts: data.maxProducts,
        maxOrders: data.maxOrders,
        features: data.features,
      },
    })

    revalidatePath("/dashboard/admin/subscriptions")
    return { success: true, plan }
  } catch (error: any) {
    console.error("Error updating plan:", error)
    return { error: `Failed to update plan: ${error.message || "Unknown error"}` }
  }
}

