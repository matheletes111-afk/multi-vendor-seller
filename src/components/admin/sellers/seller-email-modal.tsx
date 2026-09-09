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
import { Mail, Send, AlertCircle, CheckCircle2, Loader2, Sparkles } from "lucide-react"

export interface SellerEmailTarget {
  id: string
  name?: string | null
  businessName?: string | null
  email?: string | null
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
    label: "Custom Message (Write your own)",
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

export function SellerEmailModal({
  open,
  onOpenChange,
  seller,
  onSuccess,
}: SellerEmailModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState("custom")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Reset state on modal open
  useEffect(() => {
    if (open && seller) {
      setSelectedTemplate("custom")
      setSubject("")
      setMessage("")
      setError(null)
      setSuccessMessage(null)
    }
  }, [open, seller])

  const handleTemplateChange = (val: string) => {
    setSelectedTemplate(val)
    const tpl = EMAIL_TEMPLATES.find((t) => t.id === val)
    if (tpl && val !== "custom") {
      setSubject(tpl.subject)
      setMessage(tpl.body)
    }
  }

  const handleSendEmail = async () => {
    if (!seller) return
    if (!subject.trim()) {
      setError("Please provide an email subject.")
      return
    }
    if (!message.trim()) {
      setError("Please write an email message body.")
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
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to send email")
      }

      setSuccessMessage(data.message || `Email sent successfully to ${seller.email}!`)
      onSuccess?.()

      setTimeout(() => {
        onOpenChange(false)
      }, 1500)
    } catch (err: any) {
      setError(err?.message || "Failed to send email")
    } finally {
      setLoading(false)
    }
  }

  const targetDisplayName = seller?.businessName || seller?.name || "Seller Partner"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] rounded-3xl p-6 border-slate-200 dark:border-slate-800 shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Mail className="h-5 w-5" />
              </div>
              <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Send Direct Email
              </DialogTitle>
            </div>
            {seller?.sellerType && (
              <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5 rounded-full">
                {seller.sellerType}
              </Badge>
            )}
          </div>
          <DialogDescription className="text-xs text-slate-500">
            Compose and dispatch an official email notice directly to this partner via SendGrid.
          </DialogDescription>
        </DialogHeader>

        {/* Recipient Card */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Recipient Partner:</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">{targetDisplayName}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Email Address:</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">{seller?.email || "No email on file"}</span>
          </div>
        </div>

        {/* Template Picker */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            Quick Template (Optional)
          </Label>
          <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
            <SelectTrigger className="rounded-xl text-xs h-9">
              <SelectValue placeholder="Choose a preset template..." />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {EMAIL_TEMPLATES.map((tpl) => (
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
            Email Subject <span className="text-rose-500">*</span>
          </Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g., Action Required: Missing Documents for Your MEEEM Account"
            className="rounded-xl text-xs h-9"
            disabled={loading}
          />
        </div>

        {/* Message Body */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Message Body <span className="text-rose-500">*</span>
            </Label>
            <span className="text-[11px] text-slate-400">{message.length} chars</span>
          </div>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message to the seller partner here. Paragraphs will be cleanly formatted in the branded email..."
            className="rounded-2xl text-xs min-h-[140px] resize-y"
            disabled={loading}
          />
        </div>

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
            onClick={handleSendEmail}
            disabled={loading || !seller?.email}
            className="rounded-2xl text-xs h-9 font-semibold bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-md shadow-blue-600/20"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Sending...
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
