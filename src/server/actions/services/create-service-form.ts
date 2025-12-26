"use server"

import { createService } from "./create-service"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { isServiceSeller } from "@/lib/rbac"

export async function createServiceForm(formData: FormData) {
  // Check auth first before processing
  const session = await auth()
  
  if (!session?.user || !isServiceSeller(session.user)) {
    redirect("/login?error=session_expired")
  }

  const imagesInput = formData.get("images") as string
  const images = imagesInput
    ? imagesInput.split("\n").map((url) => url.trim()).filter((url) => url.length > 0)
    : []

  const basePriceInput = formData.get("basePrice") as string
  const durationInput = formData.get("duration") as string

  // Validate required fields
  const name = formData.get("name") as string
  const categoryId = formData.get("categoryId") as string
  const serviceType = formData.get("serviceType") as "APPOINTMENT" | "FIXED_PRICE"

  if (!name || !categoryId || !serviceType) {
    redirect("/dashboard/seller/services/new?error=missing_required_fields")
  }

  // Parse basePrice and duration, handling empty strings
  let basePrice: number | undefined = undefined
  if (basePriceInput && basePriceInput.trim()) {
    const parsed = parseFloat(basePriceInput)
    if (!isNaN(parsed) && parsed > 0) {
      basePrice = parsed
    }
  }

  let duration: number | undefined = undefined
  if (durationInput && durationInput.trim()) {
    const parsed = parseInt(durationInput)
    if (!isNaN(parsed) && parsed > 0) {
      duration = parsed
    }
  }

  const data = {
    name,
    description: (formData.get("description") as string) || undefined,
    categoryId,
    serviceType,
    basePrice,
    duration,
    images: images.length > 0 ? images : undefined,
  }

  console.log("Service form data:", data)

  const result = await createService(data)

  if (result.error) {
    const errorMsg = typeof result.error === "string" 
      ? result.error 
      : result.details 
        ? JSON.stringify(result.details)
        : "Failed to create service"
    console.error("Service creation error:", result.error, result.details)
    redirect(`/dashboard/seller/services/new?error=${encodeURIComponent(errorMsg)}`)
  }

  console.log("Service created successfully:", result.service?.id)
  redirect("/dashboard/seller/services?success=created")
}

