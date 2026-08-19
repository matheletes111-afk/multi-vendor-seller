"use client"

import React, { useState } from "react"
import {
  Mail,
  Copy,
  Check,
  Send,
  Building,
  CheckCircle2,
  ShieldCheck,
  FileText,
  Clock,
  Trash2,
  Lock,
  ArrowRight,
  LifeBuoy,
  BadgeCheck,
} from "lucide-react"
import { Button } from "@/ui/button"
import Link from "next/link"

export function DeleteAccountSinglePageClient() {
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [copiedTemplate, setCopiedTemplate] = useState(false)

  const supportEmail = "support@meeemsl.com"
  const emailSubject = "Account Deletion Request - MEEEM App"

  const emailBodyTemplate = `Dear MEEEM Support Team,

I would like to request the permanent deletion of my account and associated personal data from the MEEEM App.

Account Information:
- Registered Full Name: [Enter Your Full Name]
- Registered Mobile Number / Email Address: [Enter Your Registered Mobile / Email]
- Associated Store / Business Name (if applicable): [Enter Store / Business Name]
- Reason for deletion (Optional): [Enter Reason Here]

I understand that this action is permanent and request that you process my account deletion in accordance with your data retention policy.

Thank you.`

  const mailtoLink = `mailto:${supportEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBodyTemplate)}`

  const copyToClipboard = (text: string, type: "email" | "template") => {
    navigator.clipboard.writeText(text)
    if (type === "email") {
      setCopiedEmail(true)
      setTimeout(() => setCopiedEmail(false), 2000)
    } else if (type === "template") {
      setCopiedTemplate(true)
      setTimeout(() => setCopiedTemplate(false), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/60 py-6 sm:py-8">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Main Document Paper Container */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-10 md:p-12 space-y-10">

          {/* Header Title Section */}
          <div className="border-b border-slate-200 pb-8 space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-sm font-bold tracking-wide">
              <BadgeCheck className="w-4 h-4 text-rose-600" />
              <span>Official Policy</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              MEEEM Seller App – Account & Data Deletion Request
            </h1>

            <p className="text-base sm:text-lg text-slate-700 leading-relaxed">
              At <strong>MEEEM E-commerce Ltd.</strong>, we respect your privacy and give you full control over your data. If you wish to delete your seller account and remove your associated personal information, please follow the process outlined below.
            </p>
          </div>

          {/* Section 1: How to Request Account Deletion */}
          <section className="space-y-5">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              How to Request Account Deletion
            </h2>

            <p className="text-base sm:text-lg text-slate-700 leading-relaxed">
              To initiate an account deletion request, send an email to our support team:
            </p>

            <div className="space-y-3 pl-4 border-l-4 border-rose-500 bg-rose-50/40 p-4 rounded-r-xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-bold text-slate-900">Support Email:</span>
                <a
                  href={`mailto:${supportEmail}`}
                  className="text-base sm:text-lg font-mono font-bold text-rose-600 hover:underline"
                >
                  {supportEmail}
                </a>
                <button
                  type="button"
                  onClick={() => copyToClipboard(supportEmail, "email")}
                  className="ml-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:text-rose-600 shadow-xs"
                >
                  {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedEmail ? "Copied" : "Copy Email"}</span>
                </button>
              </div>

              <div>
                <span className="text-base font-bold text-slate-900">Subject Line: </span>
                <span className="text-base font-mono font-semibold text-slate-800">
                  {emailSubject}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                asChild
                className="rounded-xl px-6 h-11 text-base font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
              >
                <a href={mailtoLink}>
                  <Send className="w-4 h-4 mr-2" />
                  <span>Launch Email Client (Pre-filled)</span>
                </a>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => copyToClipboard(emailBodyTemplate, "template")}
                className="rounded-xl px-5 h-11 text-base font-semibold border-slate-300 text-slate-800 hover:bg-slate-50"
              >
                {copiedTemplate ? (
                  <>
                    <Check className="w-4 h-4 mr-2 text-emerald-600" />
                    <span>Template Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    <span>Copy Email Template</span>
                  </>
                )}
              </Button>
            </div>
          </section>

          {/* Section 2: Information to Include in Your Request */}
          <section className="space-y-4 border-t border-slate-200 pt-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Information to Include in Your Request
            </h2>

            <p className="text-base sm:text-lg text-slate-700 leading-relaxed">
              Please send your email from your <strong>registered email address</strong> and include:
            </p>

            <ul className="space-y-3 text-base sm:text-lg text-slate-800 pl-2">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Registered Seller Full Name</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Registered Mobile Number / Email Address</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Associated Store / Business Name</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Reason for deletion</strong> (Optional)</span>
              </li>
            </ul>
          </section>

          {/* Section 3: Data Retention & Deletion Policy (Section-Wise Text, NOT Cards) */}
          <section className="space-y-6 border-t border-slate-200 pt-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Data Retention & Deletion Policy
            </h2>

            <div className="space-y-5 text-base sm:text-lg text-slate-700 leading-relaxed">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-1">
                  Types of Data Deleted:
                </h3>
                <p>
                  Upon account deletion, your personal profile information, store details, active/draft product listings, saved credentials, and user preferences will be permanently removed from our active databases and servers.
                </p>
              </div>

              <div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-1">
                  Types of Data Retained:
                </h3>
                <p>
                  Historical transaction records, completed order logs, tax records, and invoice data will be retained for a legally required statutory period to comply with financial, tax, and regulatory auditing obligations.
                </p>
              </div>

              <div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-1">
                  Processing Timeline:
                </h3>
                <p>
                  Account deletion requests are verified and processed within <strong>7 to 14 business days</strong>. You will receive an email confirmation once your account and data have been successfully purged.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: Company Information */}
          <section className="border-t border-slate-200 pt-8 space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Company Information
            </h2>
            <p className="text-base sm:text-lg text-slate-700">
              <strong>MEEEM E-commerce Ltd.</strong>
            </p>
            <p className="text-base text-slate-600">
              Support Email: <a href={`mailto:${supportEmail}`} className="font-mono font-bold text-rose-600 hover:underline">{supportEmail}</a>
            </p>
          </section>

        </div>

        {/* Bottom Navigation Links */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-600">
          <Link href="/terms" className="hover:text-indigo-600 hover:underline font-semibold">
            All Terms
          </Link>
          <span>•</span>
          <Link href="/terms-and-conditions" className="hover:text-indigo-600 hover:underline font-semibold">
            Terms & Conditions
          </Link>
          <span>•</span>
          <Link href="/privacy-policy" className="hover:text-indigo-600 hover:underline font-semibold">
            Privacy Policy
          </Link>
          <span>•</span>
          <Link href="/support" className="hover:text-indigo-600 hover:underline font-semibold">
            Support Desk
          </Link>
        </div>

      </div>
    </div>
  )
}
