"use client"

import { useState } from "react"
import { Button } from "@/ui/button"
import {
  QrCode,
  PhoneCall,
  CreditCard,
  ExternalLink,
  Copy,
  Check,
  Smartphone,
} from "lucide-react"

export type FloatSubType = "in-app" | "momo" | "card"

export function getFloatPaymentTypeFromLink(flotPaymentLink?: string | null): FloatSubType | null {
  if (!flotPaymentLink || typeof flotPaymentLink !== "string") return null
  const trimmed = flotPaymentLink.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("*")) return "momo"
  if (trimmed.toLowerCase().startsWith("flot://")) return "in-app"
  if (/^https?:\/\//i.test(trimmed)) return "card"
  return null
}

export function formatFloatPaymentLabel(flotPaymentLink?: string | null, withIcon = true): string {
  const prefix = withIcon ? "💳 " : ""
  const subType = getFloatPaymentTypeFromLink(flotPaymentLink)
  if (subType === "in-app") return `${prefix}Float (Flot App)`
  if (subType === "momo") return `${prefix}Float (Mobile Money)`
  if (subType === "card") return `${prefix}Float (Bank Card)`
  return `${prefix}Float`
}

const FLOAT_OPTIONS: Array<{
  value: FloatSubType
  title: string
  description: string
  icon: typeof CreditCard
}> = [
  {
    value: "in-app",
    title: "Flot App",
    description: "Open the Flot app or scan a QR code.",
    icon: QrCode,
  },
  {
    value: "momo",
    title: "Mobile Money",
    description: "Pay with a Mobile Money code.",
    icon: PhoneCall,
  },
  {
    value: "card",
    title: "Bank Card",
    description: "Pay on Flot's secure card page.",
    icon: CreditCard,
  },
]

interface FloatMethodSelectorProps {
  value: FloatSubType
  onChange: (next: FloatSubType) => void
  disabled?: boolean
  compact?: boolean
}

export function FloatMethodSelector({
  value,
  onChange,
  disabled = false,
  compact = false,
}: FloatMethodSelectorProps) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Choose how to pay via Flot
      </p>
      <div className={compact ? "space-y-1.5" : "space-y-2"}>
        {FLOAT_OPTIONS.map((opt) => {
          const Icon = opt.icon
          const selected = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={`w-full flex items-center gap-3 text-left rounded-xl border transition-all ${
                compact ? "p-2.5" : "p-3"
              } ${
                selected
                  ? "border-blue-600 bg-blue-50/80 dark:bg-blue-950/40 ring-1 ring-blue-500/40 shadow-xs"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              } disabled:opacity-50`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  selected
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                  {opt.title}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                  {opt.description}
                </p>
              </div>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  selected
                    ? "border-blue-600 bg-blue-600"
                    : "border-slate-300 dark:border-slate-600"
                }`}
              >
                {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface FloatPaymentInstructionsProps {
  flotType: FloatSubType
  paymentLink?: string | null
  ussdCode?: string | null
}

export function FloatPaymentInstructions({
  flotType,
  paymentLink,
  ussdCode,
}: FloatPaymentInstructionsProps) {
  const [copied, setCopied] = useState(false)

  const copyText = (text: string) => {
    if (!text || typeof navigator === "undefined" || !navigator.clipboard) return
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  if (flotType === "momo" && ussdCode) {
    return (
      <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5 space-y-2.5 text-center">
        <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
          Dial this Mobile Money USSD code on your phone:
        </p>
        <div className="flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-lg px-3 py-2.5">
          <span className="font-mono text-base sm:text-lg font-black tracking-wide text-slate-900 dark:text-white select-all">
            {ussdCode}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => copyText(ussdCode)}
            className="h-7 px-2 text-xs text-emerald-700 dark:text-emerald-300"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
        </div>
        <div className="flex items-center justify-center gap-2">
          <a
            href={`tel:${encodeURIComponent(ussdCode)}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 transition-colors"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            Dial on Mobile
          </a>
        </div>
        <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
          Approve the prompt on your handset, then click Verify / wait for confirmation.
        </p>
      </div>
    )
  }

  if (flotType === "in-app" && paymentLink) {
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(paymentLink)}`
    return (
      <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/30 p-3.5 space-y-2.5 text-center">
        <p className="text-xs font-bold text-blue-900 dark:text-blue-200">
          Scan QR code with the Flot App or tap below to open:
        </p>
        <div className="inline-flex p-2 bg-white rounded-xl border border-blue-200 shadow-xs mx-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt="Flot App QR Code"
            width={168}
            height={168}
            className="w-40 h-40 object-contain"
          />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <a
            href={paymentLink}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 transition-colors"
          >
            <Smartphone className="w-3.5 h-3.5" />
            Open Flot App
          </a>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => copyText(paymentLink)}
            className="h-8 px-2.5 text-xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
            {copied ? "Copied" : "Copy Link"}
          </Button>
        </div>
      </div>
    )
  }

  if (paymentLink && /^https?:\/\//i.test(paymentLink)) {
    return (
      <Button
        type="button"
        onClick={() => window.open(paymentLink, "_blank", "noopener,noreferrer")}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl h-10 text-xs flex items-center justify-center gap-1.5"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        Open Flot Card Checkout
      </Button>
    )
  }

  return null
}
