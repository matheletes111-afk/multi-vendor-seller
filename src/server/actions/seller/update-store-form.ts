"use server"

import { updateStore } from "./update-store"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { isSeller } from "@/lib/rbac"

export async function updateStoreForm(formData: FormData) {
  const session = await auth()
  
  if (!session?.user || !isSeller(session.user)) {
    redirect("/login?error=session_expired")
  }

  const data = {
    name: formData.get("storeName") as string,
    description: formData.get("description") as string,
    phone: formData.get("phone") as string,
    website: formData.get("website") as string,
    address: formData.get("address") as string,
    city: formData.get("city") as string,
    state: formData.get("state") as string,
    zipCode: formData.get("zipCode") as string,
    country: formData.get("country") as string,
    logo: formData.get("logo") as string,
    banner: formData.get("banner") as string,
  }

  const result = await updateStore(data)

  if (result.error) {
    const errorMsg = typeof result.error === "string"
      ? result.error
      : "Failed to update store"
    redirect(`/dashboard/seller/settings?error=${encodeURIComponent(errorMsg)}`)
  }

  redirect("/dashboard/seller/settings?success=Store information updated successfully")
}

