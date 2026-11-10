"use client"

import { useState, useEffect } from "react"
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
import { Textarea } from "@/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { formatCurrency } from "@/lib/utils"
import { Banknote, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"

export interface AdminDisburseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  sellerSector: "PRODUCT" | "SERVICE" | "HOTEL" | "RESTAURANT" | "RIDER"
  sellerId: string
  sellerName: string
  suggestedAmount: number
  payoutRequestId?: string
  defaultPayoutMethod?: string
  defaultAccountSnapshot?: string
  orderId?: string
  orderItemId?: string
  bookingId?: string
  foodOrderId?: string
}

export function AdminDisburseModal({
  isOpen,
  onClose,
  onSuccess,
  sellerSector,
  sellerId,
  sellerName,
  suggestedAmount,
  payoutRequestId,
  defaultPayoutMethod,
  defaultAccountSnapshot,
  orderId,
  orderItemId,
  bookingId,
  foodOrderId,
}: AdminDisburseModalProps) {
  const [payoutReference, setPayoutReference] = useState("")
  const [payoutMethod, setPayoutMethod] = useState(
    defaultPayoutMethod && ["AfriMoney", "Orange Money", "Bank Transfer"].includes(defaultPayoutMethod)
      ? defaultPayoutMethod
      : defaultPayoutMethod?.toLowerCase().includes("africell") || defaultPayoutMethod?.toLowerCase().includes("afri")
      ? "AfriMoney"
      : defaultPayoutMethod?.toLowerCase().includes("orange")
      ? "Orange Money"
      : "Bank Transfer"
  )
  const [payoutAccountSnapshot, setPayoutAccountSnapshot] = useState(defaultAccountSnapshot || "")
  const [amount, setAmount] = useState(String(suggestedAmount > 0 ? suggestedAmount : ""))
  const [adminNote, setAdminNote] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Reset when modal opens with new data
  useEffect(() => {
    if (isOpen) {
      setPayoutReference("")
      setPayoutMethod(
        defaultPayoutMethod && ["AfriMoney", "Orange Money", "Bank Transfer"].includes(defaultPayoutMethod)
          ? defaultPayoutMethod
          : defaultPayoutMethod?.toLowerCase().includes("africell") || defaultPayoutMethod?.toLowerCase().includes("afri")
          ? "AfriMoney"
          : defaultPayoutMethod?.toLowerCase().includes("orange")
          ? "Orange Money"
          : "Bank Transfer"
      )
      setPayoutAccountSnapshot(defaultAccountSnapshot || "")
      setAmount(String(suggestedAmount > 0 ? suggestedAmount : ""))
      setAdminNote("")
      setErrorMessage(null)
      setSuccessMessage(null)
    }
  }, [isOpen, defaultPayoutMethod, defaultAccountSnapshot, suggestedAmount])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    // Validation
    if (!payoutReference.trim()) {
      setErrorMessage("Transaction ID / Reference Number is required.")
      return
    }

    if (!payoutMethod.trim()) {
      setErrorMessage("Payout Method is required.")
      return
    }

    if (!payoutAccountSnapshot.trim()) {
      setErrorMessage("Recipient Account Snapshot is required.")
      return
    }

    const numericAmount = parseFloat(amount)
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMessage("Please enter a valid disbursement amount greater than SLE 0.00.")
      return
    }

    try {
      setLoading(true)
      const res = await fetch("/api/admin/payouts/disburse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payoutRequestId,
          sellerSector,
          sellerId,
          amount: numericAmount,
          payoutMethod: payoutMethod.trim(),
          payoutAccountSnapshot: payoutAccountSnapshot.trim(),
          payoutReference: payoutReference.trim(),
          adminNote: adminNote.trim() || undefined,
          orderId,
          orderItemId,
          bookingId,
          foodOrderId,
        }),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to disburse payout")
      }

      setSuccessMessage(json.message || "Payout successfully disbursed!")
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1200)
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred while processing disbursement.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !loading && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-3xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-2xl">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-slate-900">
                Mark Payout Disbursed
              </DialogTitle>
              <DialogDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
                Record manual remittance and debit seller net balance.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Target Seller Summary Banner */}
          <div className="rounded-2xl bg-muted/40 p-3.5 border border-muted/60 space-y-1 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-semibold">Vendor / Beneficiary:</span>
              <span className="font-bold text-slate-900">{sellerName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-semibold">Sector:</span>
              <span className="font-extrabold uppercase text-[10px] bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                {sellerSector}
              </span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-muted">
              <span className="text-muted-foreground font-semibold">Target / Owed Amount:</span>
              <span className="font-black text-emerald-600 tabular-nums text-sm">
                {formatCurrency(suggestedAmount)}
              </span>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-start gap-2 text-xs font-semibold animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl flex items-center gap-2 text-xs font-semibold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. Transaction ID / Reference No * */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
              Transaction ID / Reference No <span className="text-rose-500">*</span>
            </label>
            <Input
              value={payoutReference}
              onChange={(e) => setPayoutReference(e.target.value)}
              placeholder="e.g. AFR-TXN-98472918 or Bank Ref #8273"
              disabled={loading}
              className="rounded-xl font-mono text-xs"
              required
            />
            <p className="text-[10px] text-muted-foreground">
              Enter the bank transfer slip code or mobile money transaction ID.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 2. Payout Method * */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                Payout Method <span className="text-rose-500">*</span>
              </label>
              <Select
                value={payoutMethod}
                onValueChange={setPayoutMethod}
                disabled={loading}
              >
                <SelectTrigger className="rounded-xl text-xs font-semibold">
                  <SelectValue placeholder="Select Method" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="AfriMoney">AfriMoney</SelectItem>
                  <SelectItem value="Orange Money">Orange Money</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 4. Disbursed Amount * */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                Disbursed Amount (SLE) <span className="text-rose-500">*</span>
              </label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={loading}
                className="rounded-xl font-black text-emerald-600 text-xs"
                required
              />
            </div>
          </div>

          {/* 3. Recipient Account Snapshot * */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
              Recipient Account Snapshot <span className="text-rose-500">*</span>
            </label>
            <Input
              value={payoutAccountSnapshot}
              onChange={(e) => setPayoutAccountSnapshot(e.target.value)}
              placeholder="e.g. AfriMoney • +23276123456 • John Doe"
              disabled={loading}
              className="rounded-xl text-xs"
              required
            />
            <p className="text-[10px] text-muted-foreground">
              Snapshot of vendor account where funds were dispatched.
            </p>
          </div>

          {/* 5. Admin Note (Optional) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Admin Note <span className="text-muted-foreground font-normal">(Optional)</span>
            </label>
            <Textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Internal administrative note for reconciliation audit..."
              disabled={loading}
              rows={2}
              className="rounded-xl text-xs resize-none"
            />
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Disbursing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Confirm & Disburse Funds
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

