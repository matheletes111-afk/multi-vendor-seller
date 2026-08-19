"use client"

import React, { useState, useEffect } from "react"
import {
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  Trash2,
  Lock,
  FileText,
  Clock,
  Mail,
  UserX,
  Store,
  Briefcase,
  UtensilsCrossed,
  Building2,
  ShoppingBag,
  CheckCircle2,
  Share2,
  Send,
  Building,
  Info,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Textarea } from "@/ui/textarea"
import { Label } from "@/ui/label"
import { Badge } from "@/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/ui/alert"
import { cn } from "@/lib/utils"

export type PanelRole = "CUSTOMER" | "SELLER_PRODUCT" | "SELLER_SERVICE" | "SELLER_RESTAURANT" | "SELLER_HOTEL"

interface DeleteAccountTabContentProps {
  role: PanelRole
  panelName?: string
  panelSlug?: string
  className?: string
}

interface RoleConfig {
  name: string
  appTitle: string
  slug: string
  settingsPath: string
  subjectLine: string
  isSeller: boolean
  icon: React.ReactNode
  badgeText: string
  reasons: string[]
}

const ROLE_CONFIGS: Record<PanelRole, RoleConfig> = {
  CUSTOMER: {
    name: "Customer Account",
    appTitle: "MEEEM Customer App – Account & Data Deletion Request",
    slug: "customer",
    settingsPath: "/customer/settings?tab=delete-account",
    subjectLine: "Account Deletion Request - MEEEM Customer App",
    isSeller: false,
    icon: <ShoppingBag className="w-5 h-5 text-rose-500" />,
    badgeText: "Customer Panel",
    reasons: [
      "I no longer need the MEEEM Marketplace service",
      "I have privacy or data security concerns",
      "I created a duplicate or accidental account",
      "I experienced delivery or customer support issues",
      "I am switching to another platform",
      "Other reasons",
    ],
  },
  SELLER_PRODUCT: {
    name: "Product Seller Account",
    appTitle: "MEEEM Seller App – Account & Data Deletion Request",
    slug: "product-seller",
    settingsPath: "/product-seller/settings?tab=delete-account",
    subjectLine: "Account Deletion Request - MEEEM Seller App",
    isSeller: true,
    icon: <Store className="w-5 h-5 text-rose-500" />,
    badgeText: "Product Seller Panel",
    reasons: [
      "Closing or restructuring my retail business",
      "Dissatisfied with platform fees or commission rates",
      "Low sales volume or insufficient customer demand",
      "Moving to an independent proprietary website",
      "Temporary operational suspension",
      "Other reasons",
    ],
  },
  SELLER_SERVICE: {
    name: "Service Provider Account",
    appTitle: "MEEEM Seller App – Account & Data Deletion Request",
    slug: "service-seller",
    settingsPath: "/service-seller/settings?tab=delete-account",
    subjectLine: "Account Deletion Request - MEEEM Seller App (Service Provider)",
    isSeller: true,
    icon: <Briefcase className="w-5 h-5 text-rose-500" />,
    badgeText: "Service Provider Panel",
    reasons: [
      "No longer providing commercial or freelance services",
      "Relocating to another city or geographic coverage area",
      "Unhappy with booking fees or commission terms",
      "Transitioning to direct client management",
      "Other reasons",
    ],
  },
  SELLER_RESTAURANT: {
    name: "Restaurant Partner Account",
    appTitle: "MEEEM Seller App – Account & Data Deletion Request",
    slug: "restaurant-seller",
    settingsPath: "/restaurant-seller/settings?tab=delete-account",
    subjectLine: "Account Deletion Request - MEEEM Seller App (Restaurant Partner)",
    isSeller: true,
    icon: <UtensilsCrossed className="w-5 h-5 text-rose-500" />,
    badgeText: "Restaurant Seller Panel",
    reasons: [
      "Closing physical restaurant or kitchen operations",
      "Managing in-house delivery services directly",
      "Commission rates or margin concerns",
      "Kitchen capacity or staffing constraints",
      "Other reasons",
    ],
  },
  SELLER_HOTEL: {
    name: "Hotel & Property Host Account",
    appTitle: "MEEEM Seller App – Account & Data Deletion Request",
    slug: "hotel-seller",
    settingsPath: "/hotel-seller/settings?tab=delete-account",
    subjectLine: "Account Deletion Request - MEEEM Seller App (Hotel Host)",
    isSeller: true,
    icon: <Building2 className="w-5 h-5 text-rose-500" />,
    badgeText: "Hotel Seller Panel",
    reasons: [
      "Property sold, leased, or no longer taking transient guests",
      "Switching exclusively to offline direct bookings",
      "Seasonal or temporary closure of the hotel",
      "Commission fees or channel management preference",
      "Other reasons",
    ],
  },
}

export function DeleteAccountTabContent({
  role,
  panelName,
  panelSlug,
  className,
}: DeleteAccountTabContentProps) {
  const config = ROLE_CONFIGS[role] || ROLE_CONFIGS.CUSTOMER
  const displayName = panelName || config.name

  const [origin, setOrigin] = useState("")
  const [copiedSettingsUrl, setCopiedSettingsUrl] = useState(false)
  const [copiedPublicUrl, setCopiedPublicUrl] = useState(false)
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [copiedTemplate, setCopiedTemplate] = useState(false)

  // Form State for optional direct submission
  const [reason, setReason] = useState("")
  const [feedback, setFeedback] = useState("")
  const [confirmClearObligations, setConfirmClearObligations] = useState(false)
  const [confirmPermanent, setConfirmPermanent] = useState(false)
  const [confirmDeleteText, setConfirmDeleteText] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [ticketId, setTicketId] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin)
    }
  }, [])

  const fullSettingsUrl = `${origin}${config.settingsPath}`
  const fullPublicUrl = `${origin}/delete-account`

  const emailBodyTemplate = `Dear MEEEM Support Team,

I would like to request the permanent deletion of my ${config.isSeller ? "seller" : "customer"} account and associated personal data.

Account Information:
- Registered Full Name: [Enter Your Full Name]
- Registered Mobile Number / Email: [Enter Your Mobile or Email]
${config.isSeller ? "- Associated Store / Business Name: [Enter Store / Business Name]\n" : ""}- Reason for Deletion: [Optional reason]

I understand that this action is irreversible and request that you process my account deletion in accordance with your data retention policy.

Thank you.`

  const mailtoLink = `mailto:support@meeemsl.com?subject=${encodeURIComponent(config.subjectLine)}&body=${encodeURIComponent(emailBodyTemplate)}`

  const copyToClipboard = (text: string, type: "settings" | "public" | "email" | "template") => {
    navigator.clipboard.writeText(text)
    if (type === "settings") {
      setCopiedSettingsUrl(true)
      setTimeout(() => setCopiedSettingsUrl(false), 2000)
    } else if (type === "public") {
      setCopiedPublicUrl(true)
      setTimeout(() => setCopiedPublicUrl(false), 2000)
    } else if (type === "email") {
      setCopiedEmail(true)
      setTimeout(() => setCopiedEmail(false), 2000)
    } else if (type === "template") {
      setCopiedTemplate(true)
      setTimeout(() => setCopiedTemplate(false), 2000)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    if (!reason) {
      setSubmitError("Please select a primary reason for account deletion.")
      return
    }
    if (!confirmClearObligations || !confirmPermanent) {
      setSubmitError("Please check both confirmation boxes before submitting your request.")
      return
    }
    if (confirmDeleteText.trim().toUpperCase() !== "DELETE") {
      setSubmitError('Please type the word "DELETE" into the confirmation field.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/account/delete-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          panelSlug: config.slug,
          reason,
          feedback,
          panelSettingsUrl: fullSettingsUrl,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit account deletion request. Please try again.")
      }

      setTicketId(data.ticketId || `DEL-${Date.now().toString().slice(-6)}`)
      setIsSubmitted(true)
    } catch (err: any) {
      setSubmitError(err.message || "An unexpected error occurred.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={cn("space-y-8 w-full max-w-6xl", className)}>
      {/* Specific Panel In-App URL & Single Unified Public URL Widget */}
      <Card className="rounded-3xl border-rose-200/90 bg-gradient-to-br from-rose-50/70 via-white to-orange-50/40 shadow-sm overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-200">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl font-bold text-slate-900">
                    Account Deletion URLs
                  </CardTitle>
                  <Badge variant="outline" className="border-rose-300 text-rose-700 bg-rose-50 text-[11px] font-semibold">
                    {config.badgeText}
                  </Badge>
                </div>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  Direct In-App URL for this specific panel and single unified public URL for Google Play & Apple App Store compliance
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {/* Specific Panel Settings Tab Deep Link */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                In-App Settings Deep-Link URL ({displayName})
              </Label>
              <span className="text-[11px] text-slate-400">Opens this specific panel settings tab directly</span>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Input
                  readOnly
                  value={fullSettingsUrl}
                  className="font-mono text-xs h-10 bg-slate-50 text-slate-700 rounded-xl pr-8 select-all border-slate-200"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(fullSettingsUrl, "settings")}
                className="rounded-xl text-xs h-10 px-4 font-semibold border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 shrink-0 flex items-center gap-1.5"
              >
                {copiedSettingsUrl ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Specific Panel URL</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* 1 Unified Public Account Deletion URL */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                Single Public Web Deletion URL (Global Portal)
              </Label>
              <span className="text-[11px] text-slate-400">Google Play & App Store Compliance Public Web Link</span>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Input
                  readOnly
                  value={fullPublicUrl}
                  className="font-mono text-xs h-10 bg-slate-50 text-slate-700 rounded-xl pr-8 select-all border-slate-200"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(fullPublicUrl, "public")}
                  className="rounded-xl text-xs h-10 px-4 font-semibold border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 shrink-0 flex items-center gap-1.5"
                >
                  {copiedPublicUrl ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Public URL</span>
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  asChild
                  className="rounded-xl text-xs h-10 px-3 text-slate-600 hover:text-slate-900 shrink-0"
                >
                  <a href="/delete-account" target="_blank" rel="noreferrer" title="Open Public Page">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Official Account Deletion Policy Card (Exact Content) */}
      <Card className="rounded-3xl border-rose-200 shadow-md bg-white overflow-hidden">
        {/* Header Alert Banner */}
        <div className="p-6 sm:p-8 bg-gradient-to-r from-rose-600 via-rose-700 to-rose-800 text-white flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
                <ShieldAlert className="w-5 h-5 text-rose-200" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                {config.appTitle}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-rose-100 leading-relaxed pt-1">
              At <strong>MEEEM E-commerce Ltd.</strong>, we respect your privacy and give you full control over your data. If you wish to delete your {config.isSeller ? "seller" : "customer"} account and remove your associated personal information, please follow the process outlined below.
            </p>
          </div>
          <Badge className="bg-white/20 text-white border border-white/30 px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0 self-start md:self-center">
            Official Deletion Policy
          </Badge>
        </div>

        <CardContent className="p-6 sm:p-8 space-y-8">
          {/* Section 1: How to Request Account Deletion */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-600"></span>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                How to Request Account Deletion
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              To initiate an account deletion request, send an email to our support team:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Support Email
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard("support@meeemsl.com", "email")}
                    className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1"
                  >
                    {copiedEmail ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedEmail ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <p className="text-sm font-mono font-bold text-slate-900">
                  support@meeemsl.com
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/80 space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Subject Line
                </span>
                <p className="text-xs sm:text-sm font-mono font-semibold text-slate-900">
                  {config.subjectLine}
                </p>
              </div>
            </div>

            {/* Quick Action Buttons for Email */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                asChild
                className="rounded-2xl px-5 h-10 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20"
              >
                <a href={mailtoLink}>
                  <Send className="w-3.5 h-3.5 mr-2" />
                  Open Email Client with Pre-filled Template
                </a>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => copyToClipboard(emailBodyTemplate, "template")}
                className="rounded-2xl px-4 h-10 text-xs font-semibold border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                {copiedTemplate ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                    <span>Template Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    <span>Copy Email Template</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Section 2: Information to Include in Your Request */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-indigo-600"></span>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Information to Include in Your Request
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Please send your email from your <strong>registered email address</strong> and include:
            </p>

            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5">
              <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Registered {config.isSeller ? "Seller" : "Customer"} Full Name</strong></span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Registered Mobile Number / Email Address</strong></span>
                </li>
                {config.isSeller && (
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Associated Store / Business Name</strong></span>
                  </li>
                )}
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Reason for deletion</strong> (Optional)</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Section 3: Data Retention & Deletion Policy */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-600"></span>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Data Retention & Deletion Policy
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl border border-rose-100 bg-rose-50/50 space-y-1.5">
                <div className="flex items-center gap-2 text-rose-900 font-bold text-xs">
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>Types of Data Deleted</span>
                </div>
                <p className="text-xs text-rose-950/80 leading-relaxed">
                  Upon account deletion, your personal profile information, store details, active/draft product listings, saved credentials, and user preferences will be permanently removed from our active servers.
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs">
                  <Lock className="w-4 h-4 text-indigo-600" />
                  <span>Types of Data Retained</span>
                </div>
                <p className="text-xs text-indigo-950/80 leading-relaxed">
                  Historical transaction records, completed order logs, tax records, and invoice data will be retained for a legally required period to comply with financial, legal, and audit regulations.
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-teal-100 bg-teal-50/50 space-y-1.5">
                <div className="flex items-center gap-2 text-teal-900 font-bold text-xs">
                  <Clock className="w-4 h-4 text-teal-600" />
                  <span>Processing Timeline</span>
                </div>
                <p className="text-xs text-teal-950/80 leading-relaxed">
                  Requests are verified and processed within <strong>7 to 14 business days</strong>. You will receive a final confirmation email once your account and data have been purged.
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Direct In-App Request Form */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-slate-900"></span>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Instant In-App Deletion Request Submission
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                You can also submit your deletion request directly through this authenticated panel:
              </p>
            </div>

            {!isSubmitted ? (
              <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
                {submitError && (
                  <Alert variant="destructive" className="rounded-2xl">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">{submitError}</AlertDescription>
                  </Alert>
                )}

                {/* Reason Selector */}
                <div className="space-y-2">
                  <Label htmlFor="delete-reason" className="text-xs font-bold text-slate-800">
                    Primary Reason for Deletion <span className="text-rose-600">*</span>
                  </Label>
                  <select
                    id="delete-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                    className="w-full h-11 px-3.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  >
                    <option value="" disabled>
                      Select a reason...
                    </option>
                    {config.reasons.map((r, idx) => (
                      <option key={idx} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Optional Feedback */}
                <div className="space-y-2">
                  <Label htmlFor="delete-feedback" className="text-xs font-bold text-slate-800">
                    Additional Details (Optional)
                  </Label>
                  <Textarea
                    id="delete-feedback"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Provide any additional context or store information..."
                    className="text-xs rounded-xl min-h-[80px] border-slate-300 bg-white"
                  />
                </div>

                {/* Safeguard Checkboxes */}
                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={confirmClearObligations}
                      onChange={(e) => setConfirmClearObligations(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-xs text-slate-700 leading-relaxed font-medium">
                      I confirm that I have fulfilled or cancelled all active orders, client appointments, bookings, and financial obligations.
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={confirmPermanent}
                      onChange={(e) => setConfirmPermanent(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-xs text-slate-700 leading-relaxed font-medium">
                      I understand that deleting my {displayName} is permanent, and that active data will be purged while required financial logs are retained for statutory compliance.
                    </span>
                  </label>
                </div>

                {/* Final Safeguard: Type DELETE */}
                <div className="space-y-2">
                  <Label htmlFor="delete-confirm-text" className="text-xs font-bold text-slate-800">
                    To confirm, type <span className="font-mono text-rose-600 font-black">DELETE</span> below <span className="text-rose-600">*</span>
                  </Label>
                  <Input
                    id="delete-confirm-text"
                    value={confirmDeleteText}
                    onChange={(e) => setConfirmDeleteText(e.target.value)}
                    placeholder="DELETE"
                    className="font-mono text-xs tracking-wider h-10 max-w-xs border-slate-300 uppercase bg-white"
                  />
                </div>

                <Button
                  type="submit"
                  variant="destructive"
                  disabled={
                    isSubmitting ||
                    !reason ||
                    !confirmClearObligations ||
                    !confirmPermanent ||
                    confirmDeleteText.trim().toUpperCase() !== "DELETE"
                  }
                  className="rounded-2xl px-6 h-11 text-xs font-bold shadow-md shadow-rose-600/20 bg-rose-600 hover:bg-rose-700 transition-all flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Submitting Request...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Submit In-App Deletion Request</span>
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 text-center space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white mx-auto flex items-center justify-center shadow-md shadow-emerald-200">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h4 className="text-base font-bold text-slate-900">
                  Deletion Request Registered
                </h4>
                <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                  Your request has been logged. Our operations team will verify your account status and complete processing within <strong>7 to 14 business days</strong>.
                </p>
                {ticketId && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-emerald-200 text-xs font-mono font-semibold text-emerald-800">
                    <span>Reference ID:</span>
                    <span className="text-slate-900">{ticketId}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 5: Company Information */}
          <div className="p-5 rounded-2xl border border-slate-200/90 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-700">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Building className="w-4 h-4 text-indigo-600" />
                <span>Company Information</span>
              </div>
              <p className="text-slate-600 font-medium">
                MEEEM E-commerce Ltd.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-rose-600" />
              <span>Contact:</span>
              <a href="mailto:support@meeemsl.com" className="font-mono font-bold text-rose-700 hover:underline">
                support@meeemsl.com
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
