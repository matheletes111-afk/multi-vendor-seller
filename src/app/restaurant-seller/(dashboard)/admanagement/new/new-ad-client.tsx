"use client"

import { NewAdForm } from "@/components/ads/new-ad-form"

export function NewAdClient() {
  return (
    <NewAdForm
      mode="restaurant-seller"
      submitUrl="/api/restaurant-seller/admanagement"
      backHref="/restaurant-seller/admanagement"
      listHref="/restaurant-seller/admanagement"
      successPath="/restaurant-seller/admanagement?success=Ad+created.+It+will+be+visible+after+admin+approval."
    />
  )
}
