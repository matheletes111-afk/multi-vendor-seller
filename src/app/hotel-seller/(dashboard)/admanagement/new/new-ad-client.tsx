"use client"

import { NewAdForm } from "@/components/ads/new-ad-form"

export function NewAdClient() {
  return (
    <NewAdForm
      mode="hotel-seller"
      submitUrl="/api/hotel-seller/admanagement"
      backHref="/hotel-seller/admanagement"
      listHref="/hotel-seller/admanagement"
      successPath="/hotel-seller/admanagement?success=Ad+created.+It+will+be+visible+after+admin+approval."
    />
  )
}
