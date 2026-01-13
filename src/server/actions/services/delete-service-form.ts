"use server"

import { deleteService } from "./delete-service"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { isServiceSeller } from "@/lib/rbac"

export async function deleteServiceForm(serviceId: string) {
  const session = await auth()
  
  if (!session?.user || !isServiceSeller(session.user)) {
    redirect("/login?error=session_expired")
  }

  const result = await deleteService(serviceId)

  if (result.error) {
    const errorMsg = typeof result.error === "string"
      ? result.error
      : "Failed to delete service"
    redirect(`/dashboard/seller/services?error=${encodeURIComponent(errorMsg)}`)
  }

  redirect("/dashboard/seller/services?success=Service deleted permanently")
}

