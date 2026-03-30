"use client"

import { NewAdForm } from "@/components/ads/new-ad-form"

export function NewAdClient() {
  return (
    <NewAdForm
      mode="product-seller"
      submitUrl="/api/product-seller/admanagement"
      backHref="/product-seller/admanagement"
      listHref="/product-seller/admanagement"
      successPath="/product-seller/admanagement?success=Ad+created.+It+will+be+visible+after+admin+approval."
    />
  )
}
