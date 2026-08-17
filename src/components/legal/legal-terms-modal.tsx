"use client"

import React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/ui/dialog"
import { Button } from "@/ui/button"
import { CheckCircle2, FileText, ShieldCheck } from "lucide-react"
import {
  FOOTER_TERMS_DOC,
  FOOTER_PRIVACY_DOC,
  VENDOR_AGREEMENT_DOC,
  PAYMENT_SETTLING_DOC,
  EXCHANGE_POLICY_DOC,
  LegalDocument,
} from "@/lib/terms-data"

export type LegalDocType =
  | "general-terms"
  | "privacy-policy"
  | "vendor-agreement"
  | "payment-settlement"
  | "exchange-policy"

interface LegalTermsModalProps {
  type: LegalDocType
  isOpen: boolean
  onClose: () => void
  onAccept?: () => void
  isAccepted?: boolean
}

export function getLegalDoc(type: LegalDocType): LegalDocument {
  switch (type) {
    case "general-terms":
      return FOOTER_TERMS_DOC
    case "privacy-policy":
      return FOOTER_PRIVACY_DOC
    case "vendor-agreement":
      return VENDOR_AGREEMENT_DOC
    case "payment-settlement":
      return PAYMENT_SETTLING_DOC
    case "exchange-policy":
      return EXCHANGE_POLICY_DOC
    default:
      return FOOTER_TERMS_DOC
  }
}

export function LegalTermsModal({
  type,
  isOpen,
  onClose,
  onAccept,
  isAccepted = false,
}: LegalTermsModalProps) {
  const doc = getLegalDoc(type)

  const handleAcceptAndClose = () => {
    if (onAccept) {
      onAccept()
    }
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col p-0 overflow-hidden rounded-3xl bg-white border-slate-200 shadow-2xl">
        {/* Modal Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-inner">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900 leading-snug">
                {doc.title}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                <span>Source: {doc.source}</span>
                <span>•</span>
                <span>Last Updated: {doc.lastUpdated}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 text-slate-700 space-y-4 text-sm leading-relaxed bg-white">
          <div
            className="prose prose-sm max-w-none text-slate-700 [&>p]:mb-3 [&>h2]:text-slate-900 [&>h2]:font-bold [&>h2]:mt-5 [&>h2]:mb-2 [&>h1]:text-slate-900 [&>h1]:font-extrabold"
            dangerouslySetInnerHTML={{ __html: doc.content }}
          />
        </div>

        {/* Modal Footer */}
        <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Official MEEEM Legal Document</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-full px-5 h-10 border-slate-200 text-slate-700 hover:bg-slate-100"
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={handleAcceptAndClose}
              className="rounded-full px-6 h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2 shadow-md transition-all hover:scale-[1.02]"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isAccepted ? "Accepted & Close" : "I Agree & Accept"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
