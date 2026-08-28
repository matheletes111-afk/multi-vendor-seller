"use client"

import React from "react"
import { useSearchParams } from "next/navigation"
import { PublicLayout } from "@/components/site-layout"
import { LegalPolicyTabContent } from "@/components/legal/legal-policy-tab-content"
import { Trash2, ArrowRight } from "lucide-react"
import Link from "next/link"

export function TermsClient({ defaultSlug }: { defaultSlug?: string } = {}) {
  const searchParams = useSearchParams()
  const docSlug = searchParams.get("doc") || defaultSlug || undefined
  const isEmbed = searchParams.get("embed") === "true"

  const content = (
    <div className="min-h-screen bg-slate-50/70 py-6 sm:py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Quick Deletion & Policy Notice Bar */}
        <div className="rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 via-orange-50 to-amber-50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-200">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Need to Delete Your Account or Remove Data?
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Review the official MEEEM App Account & Data Deletion policy and submission instructions.
              </p>
            </div>
          </div>
          <Link
            href="/delete-account"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all shrink-0"
          >
            <span>Account Deletion Request</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <LegalPolicyTabContent
          role="ADMIN"
          initialSlug={docSlug}
          isAcceptedOnboarding={false}
        />
      </div>
    </div>
  )

  if (isEmbed) {
    return <div className="min-h-screen bg-slate-50/70">{content}</div>
  }

  return <PublicLayout>{content}</PublicLayout>
}
