"use server"

import { updateService } from "./update-service"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { isServiceSeller } from "@/lib/rbac"

export async function updateServiceForm(serviceId: string, formData: FormData) {
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
  const discountStr = (formData.get("discount") as string) || "0"
  const hasGstInput = formData.get("hasGst") as string

  // Validate required fields
  const name = formData.get("name") as string
  const categoryId = formData.get("categoryId") as string
  const serviceType = formData.get("serviceType") as "APPOINTMENT" | "FIXED_PRICE"

  if (!name || !categoryId || !serviceType) {
    redirect(`/dashboard/seller/services/${serviceId}?error=missing_required_fields`)
  }

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

  const discount = Math.max(0, isNaN(parseFloat(discountStr)) ? 0 : parseFloat(discountStr))
  const hasGst = hasGstInput === "true"
  const isActiveInput = formData.get("isActive") as string
  const isActive = isActiveInput === "true"

  const data: any = {
    name,
    description: (formData.get("description") as string) || undefined,
    categoryId,
    serviceType,
    isActive,
    hasGst,
    discount,
  }

  if (basePrice !== undefined) {
    data.basePrice = basePrice
  }

  if (duration !== undefined) {
    data.duration = duration
  }

  if (images.length > 0) {
    data.images = images
  }

  console.log("Service update form data:", data)

  const result = await updateService(serviceId, data)

  if (result.error) {
    const errorMsg = typeof result.error === "string"
      ? result.error
      : "Failed to update service"
    redirect(`/dashboard/seller/services/${serviceId}?error=${encodeURIComponent(errorMsg)}`)
  }

  redirect("/dashboard/seller/services?success=Service updated successfully")
}

