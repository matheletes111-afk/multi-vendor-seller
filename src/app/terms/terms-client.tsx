"use client"

import React from "react"
import { useSearchParams } from "next/navigation"
import { PublicLayout } from "@/components/site-layout"
import { LegalPolicyTabContent } from "@/components/legal/legal-policy-tab-content"

export function TermsClient() {
  const searchParams = useSearchParams()
  const docSlug = searchParams.get("doc") || undefined
  const isEmbed = searchParams.get("embed") === "true"

  const content = (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <LegalPolicyTabContent
        role="ADMIN"
        initialSlug={docSlug}
        isAcceptedOnboarding={false}
      />
    </div>
  )

  if (isEmbed) {
    return <div className="min-h-screen bg-slate-50/50">{content}</div>
  }

  return <PublicLayout>{content}</PublicLayout>
}
