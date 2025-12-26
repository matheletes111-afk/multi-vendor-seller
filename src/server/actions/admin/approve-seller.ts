"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function approveSeller(sellerId: string) {
  const session = await auth()
  
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard/admin/sellers?error=unauthorized")
  }

  try {
    await prisma.seller.update({
      where: { id: sellerId },
      data: { isApproved: true },
    })

    revalidatePath("/dashboard/admin/sellers")
    redirect("/dashboard/admin/sellers?success=approved")
  } catch (error) {
    redirect("/dashboard/admin/sellers?error=failed")
  }
}

