"use server"

import { updateUser } from "./update-user"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { isSeller } from "@/lib/rbac"

export async function updateUserForm(formData: FormData) {
  const session = await auth()
  
  if (!session?.user || !isSeller(session.user)) {
    redirect("/login?error=session_expired")
  }

  const data = {
    name: formData.get("name") as string,
    image: formData.get("image") as string,
  }

  const result = await updateUser(data)

  if (result.error) {
    const errorMsg = typeof result.error === "string"
      ? result.error
      : "Failed to update profile"
    redirect(`/dashboard/seller/settings?error=${encodeURIComponent(errorMsg)}`)
  }

  redirect("/dashboard/seller/settings?success=Profile updated successfully")
}

