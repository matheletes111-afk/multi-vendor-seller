"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import { Badge } from "@/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import {
  Mail,
  Send,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Smartphone,
  Phone,
  MessageSquare,
} from "lucide-react"

export interface SellerEmailTarget {
  id: string
  name?: string | null
  businessName?: string | null
  email?: string | null
  phone?: string | null
  phoneCountryCode?: string | null
  sellerType?: "PRODUCT" | "SERVICE" | "HOTEL" | "RESTAURANT" | string
}

interface SellerEmailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  seller: SellerEmailTarget | null
  onSuccess?: () => void
}

const EMAIL_TEMPLATES = [
  {
    id: "custom",
    label: "Custom Email (Write your own)",
    subject: "",
    body: "",
  },
  {
    id: "missing_docs",
    label: "Missing Documents Reminder",
    subject: "Action Required: Missing Documents for Your MEEEM Seller Account",
    body: `Hello,\n\nWe are currently reviewing your vendor application on the MEEEM marketplace platform.\n\nOur verification team noted that certain required business or identification documents are still pending upload or need re-submission. Please log in to your vendor dashboard to complete your document uploads so we can finalize and approve your account.\n\nThank you for choosing MEEEM!`,
  },
  {
    id: "onboarding_support",
    label: "Onboarding Assistance & Support",
    subject: "Need Help Completing Your MEEEM Seller Setup?",
    body: `Hello,\n\nWe noticed that you started setting up your seller account on MEEEM, but your onboarding is not yet complete.\n\nOur onboarding specialist team is ready to assist you step-by-step with setting up your store, catalog, and payout details. Please let us know if you need assistance, or complete your setup directly in the onboarding portal.\n\nWe look forward to growing your business with MEEEM!`,
  },
  {
    id: "account_notice",
    label: "Official Account / Policy Notice",
    subject: "Important Notice Regarding Your MEEEM Partner Account",
    body: `Dear Partner,\n\nPlease review this official notice regarding your seller account on the MEEEM marketplace.\n\nEnsure that all your product or service listings, pricing, and operating details adhere to the MEEEM Vendor Policies and Terms of Service. If any adjustments are requested by our team, please update your account accordingly.\n\nThank you for your ongoing partnership.`,
  },
]

const SMS_TEMPLATES = [
  {
    id: "custom",
    label: "Custom SMS (Write your own)",
    subject: "",
    body: "",
  },
  {
    id: "missing_docs",
    label: "Missing Documents Reminder (SMS)",
    subject: "Missing Documents",
    body: `Our verification team noted that certain required business or ID documents are still pending upload for your MEEEM seller account. Please log in to your vendor dashboard to upload your documents so we can finalize and approve your account. Thank you!`,
  },
  {
    id: "onboarding_support",
    label: "Onboarding Assistance & Support (SMS)",
    subject: "Onboarding Setup",
    body: `We noticed your MEEEM seller account setup is not yet complete. Our onboarding specialist team is ready to assist you. Please visit your dashboard to complete setup or reply for support.`,
  },
  {
    id: "account_notice",
    label: "Official Account / Policy Notice (SMS)",
    subject: "Account Notice",
    body: `Please review your MEEEM seller dashboard for an important update regarding your store catalog, pricing, or operating compliance. Thank you for your continued partnership.`,
  },
]

export function SellerEmailModal({
  open,
  onOpenChange,
  seller,
  onSuccess,
}: SellerEmailModalProps) {
  const hasEmail = Boolean(seller?.email && seller.email.trim())
  const hasPhone = Boolean(seller?.phone && seller.phone.trim())

  const [selectedChannel, setSelectedChannel] = useState<"email" | "sms">("email")
  const [selectedTemplate, setSelectedTemplate] = useState("custom")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Reset state on modal open
  useEffect(() => {
    if (open && seller) {
      const emailAvail = Boolean(seller.email && seller.email.trim())
      setSelectedChannel(emailAvail ? "email" : "sms")
      setSelectedTemplate("custom")
      setSubject("")
      setMessage("")
      setError(null)
      setSuccessMessage(null)
    }
  }, [open, seller])

  const handleChannelChange = (newChannel: "email" | "sms") => {
    setSelectedChannel(newChannel)
    const activeTemplates = newChannel === "sms" ? SMS_TEMPLATES : EMAIL_TEMPLATES
    const tpl = activeTemplates.find((t) => t.id === selectedTemplate)
    if (tpl && selectedTemplate !== "custom") {
      setSubject(tpl.subject)
      setMessage(tpl.body)
    }
  }

  const handleTemplateChange = (val: string) => {
    setSelectedTemplate(val)
    const activeTemplates = selectedChannel === "sms" ? SMS_TEMPLATES : EMAIL_TEMPLATES
    const tpl = activeTemplates.find((t) => t.id === val)
    if (tpl && val !== "custom") {
      setSubject(tpl.subject)
      setMessage(tpl.body)
    }
  }

  const handleSendMessage = async () => {
    if (!seller) return

    if (selectedChannel === "email" && !subject.trim()) {
      setError("Please provide an email subject.")
      return
    }
    if (!message.trim()) {
      setError("Please write a message body.")
      return
    }

    setLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const res = await fetch(`/api/admin/sellers/${seller.id}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
          sellerType: seller.sellerType,
          channel: selectedChannel,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to send message")
      }

      setSuccessMessage(
        data.message ||
          (selectedChannel === "email"
            ? `Email sent successfully to ${seller.email}!`
            : `SMS notification successfully sent to ${seller.phone}!`)
      )
      onSuccess?.()

      setTimeout(() => {
        onOpenChange(false)
      }, 1500)
    } catch (err: any) {
      setError(err?.message || "Failed to send message")
    } finally {
      setLoading(false)
    }
  }

  const targetDisplayName = seller?.businessName || seller?.name || "Seller Partner"
  const isSmsMode = selectedChannel === "sms"

  const cleanSubject = subject.trim()
  const smsHeadline = cleanSubject && !cleanSubject.toLowerCase().includes("meeem notice")
    ? `${cleanSubject} - `
    : ""
  const currentMessage = message.trim()
  const previewSmsText = `Hi ${targetDisplayName}, MEEEM Notice: ${smsHeadline}${currentMessage || "(Your message text will appear here...)"}`
  const totalSmsLength = currentMessage ? `Hi ${targetDisplayName}, MEEEM Notice: ${smsHeadline}${currentMessage}`.length : 0
  const smsSegments = totalSmsLength === 0 ? 0 : (totalSmsLength <= 160 ? 1 : Math.ceil(totalSmsLength / 153))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] rounded-3xl p-6 border-slate-200 dark:border-slate-800 shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`h-9 w-9 rounded-2xl flex items-center justify-center ${
                  isSmsMode
                    ? "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400"
                    : "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400"
                }`}
              >
                {isSmsMode ? <Smartphone className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
              </div>
              <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {isSmsMode ? "Send Direct SMS" : "Send Direct Email"}
              </DialogTitle>
            </div>
            {seller?.sellerType && (
              <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5 rounded-full">
                {seller.sellerType}
              </Badge>
            )}
          </div>
          <DialogDescription className="text-xs text-slate-500">
            {isSmsMode
              ? "Dispatch an official SMS text notice directly to the partner's mobile phone via Twilio (supports up to 1,600 characters)."
              : "Compose and dispatch an official email notice directly to this partner via SendGrid."}
          </DialogDescription>
        </DialogHeader>

        {/* Recipient Card */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Recipient Partner:</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">{targetDisplayName}</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Contact Destination:</span>
            <div className="flex items-center gap-2 text-right">
              {hasEmail ? (
                <span className="font-semibold text-blue-600 dark:text-blue-400 font-mono text-[11px]">
                  {seller?.email}
                </span>
              ) : null}
              {hasPhone ? (
                <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                  📱 {seller?.phone}
                </span>
              ) : null}
              {!hasEmail && !hasPhone ? (
                <span className="font-semibold text-rose-500">No contact on file</span>
              ) : null}
            </div>
          </div>

          {/* Delivery Channel Switcher / Indicator */}
          {hasEmail && hasPhone ? (
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold">
                Delivery Channel:
              </span>
              <div className="inline-flex rounded-xl p-0.5 bg-slate-200/80 dark:bg-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => handleChannelChange("email")}
                  className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                    selectedChannel === "email"
                      ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => handleChannelChange("sms")}
                  className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                    selectedChannel === "sms"
                      ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  SMS
                </button>
              </div>
            </div>
          ) : !hasEmail && hasPhone ? (
            <div className="pt-1.5 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Channel:</span>
              <Badge className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 text-[11px] font-semibold gap-1">
                <Smartphone className="h-3 w-3" />
                Phone Registration Only (SMS Dispatch)
              </Badge>
            </div>
          ) : hasEmail && !hasPhone ? (
            <div className="pt-1.5 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Channel:</span>
              <Badge className="bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300 text-[11px] font-semibold gap-1">
                <Mail className="h-3 w-3" />
                Email Channel
              </Badge>
            </div>
          ) : null}
        </div>

        {/* Warning if no contact available */}
        {!hasEmail && !hasPhone && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>This seller partner does not have an email address or mobile phone number on file.</span>
          </div>
        )}

        {/* Template Picker */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            {isSmsMode ? "SMS Template Preset (Optional)" : "Email Template Preset (Optional)"}
          </Label>
          <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
            <SelectTrigger className="rounded-xl text-xs h-9">
              <SelectValue placeholder="Choose a preset template..." />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {(isSmsMode ? SMS_TEMPLATES : EMAIL_TEMPLATES).map((tpl) => (
                <SelectItem key={tpl.id} value={tpl.id} className="text-xs">
                  {tpl.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Subject */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {isSmsMode ? "SMS Header / Headline (Optional)" : "Email Subject"}{" "}
            {!isSmsMode && <span className="text-rose-500">*</span>}
          </Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={
              isSmsMode
                ? "e.g., Missing Documents (prepended to SMS)"
                : "e.g., Action Required: Missing Documents for Your MEEEM Account"
            }
            className="rounded-xl text-xs h-9"
            disabled={loading}
          />
        </div>

        {/* Message Body */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isSmsMode ? "SMS Message Body" : "Email Message"} <span className="text-rose-500">*</span>
            </Label>
            <span className="text-[11px] text-slate-400">
              {message.length} chars
              {isSmsMode && (
                <span className="ml-1 text-slate-500 font-mono">
                  (max 1,500 • ~{smsSegments} segment{smsSegments !== 1 ? "s" : ""})
                </span>
              )}
            </span>
          </div>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={isSmsMode ? 1500 : undefined}
            placeholder={
              isSmsMode
                ? "Type your SMS notice to the seller partner here (up to 1,500 chars). Twilio will concatenate multi-segment messages seamlessly..."
                : "Type your message to the seller partner here. Paragraphs will be cleanly formatted in the branded email..."
            }
            className={`rounded-2xl text-xs resize-y ${isSmsMode ? "min-h-[100px]" : "min-h-[140px]"}`}
            disabled={loading}
          />
        </div>

        {/* Live SMS Phone Preview */}
        {isSmsMode && (
          <div className="rounded-2xl bg-amber-500/5 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                Live Handset Preview (Exact SMS Notice)
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                  smsSegments <= 1
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : smsSegments <= 3
                    ? "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                    : "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                }`}
              >
                {smsSegments === 0 ? "0 segments" : `${smsSegments} segment${smsSegments > 1 ? "s" : ""}`} ({totalSmsLength}/1600)
              </Badge>
            </div>
            
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-amber-200/60 dark:border-amber-900/50 p-3 shadow-inner">
              <div className="flex items-start gap-2.5">
                <div className="h-7 w-7 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 text-xs font-bold">
                  SMS
                </div>
                <div className="space-y-1 text-xs min-w-0 flex-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="truncate">To: {seller?.phone || targetDisplayName}</span>
                    <span className="shrink-0">Just now</span>
                  </div>
                  <p className="font-sans text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed break-words text-[12px]">
                    {previewSmsText}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-0.5">
              <span>Full text delivered via Twilio</span>
              <span>No cut-off • Reassembled on handset</span>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="rounded-2xl text-xs h-9"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSendMessage}
            disabled={
              loading ||
              (!hasEmail && !hasPhone) ||
              (isSmsMode ? !hasPhone || !message.trim() : !hasEmail || !subject.trim() || !message.trim())
            }
            className={`rounded-2xl text-xs h-9 font-semibold text-white gap-1.5 shadow-md ${
              isSmsMode
                ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
                : "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20"
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Sending...
              </>
            ) : isSmsMode ? (
              <>
                <Smartphone className="h-3.5 w-3.5" />
                Send SMS
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
