"use client"

import { useState, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/ui/dialog"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Badge } from "@/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/ui/tabs"
import { formatCurrency } from "@/lib/utils"
import {
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  RefreshCw,
  Gift,
  CreditCard,
  ExternalLink,
} from "lucide-react"

export interface SubscriptionPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: {
    id: string
    name?: string
    displayName?: string
    price: number
    duration?: number
    description?: string | null
  } | null
  sellerType?: "PRODUCT_SERVICE" | "HOTEL" | "RESTAURANT"
  currentSubscription?: {
    id?: string
    status?: string
    currentPeriodEnd?: string | Date | null
    plan?: { price: number; displayName?: string }
  } | null
  appliedCoupon?: {
    code: string
    discountAmount: number
    finalAmount: number
  } | null
  initialMethod?: "AFRIMONEY" | "FLOAT"
  onSuccess?: () => void
}

export function SubscriptionPaymentDialog({
  open,
  onOpenChange,
  plan,
  sellerType = "PRODUCT_SERVICE",
  currentSubscription,
  appliedCoupon,
  initialMethod = "AFRIMONEY",
  onSuccess,
}: SubscriptionPaymentDialogProps) {
  const [method, setMethod] = useState<"AFRIMONEY" | "FLOAT">(initialMethod)
  const [phone, setPhone] = useState("")
  const [state, setState] = useState<"idle" | "initiating" | "waiting" | "success" | "error">("idle")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [purchaseId, setPurchaseId] = useState<string | null>(null)
  const [flotPaymentLink, setFlotPaymentLink] = useState<string | null>(null)
  const [activatedStatus, setActivatedStatus] = useState<"ACTIVE" | "QUEUED">("ACTIVE")
  const [isChecking, setIsChecking] = useState(false)

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = null
    }
  }

  useEffect(() => {
    return () => stopPolling()
  }, [])

  useEffect(() => {
    if (initialMethod) {
      setMethod(initialMethod)
    }
  }, [initialMethod, open])

  useEffect(() => {
    if (!open) {
      stopPolling()
      if (state !== "success") {
        setState("idle")
        setError("")
        setMessage("")
        setPurchaseId(null)
        setFlotPaymentLink(null)
      }
    }
  }, [open, state])

  if (!plan) return null

  const payablePrice = appliedCoupon ? appliedCoupon.finalAmount : plan.price
  const durationDays = plan.duration || 30

  // Inspect current subscription for Decision G Carry-Forward or Queueing
  const now = new Date()
  const isCurrentActive =
    currentSubscription &&
    (currentSubscription.status === "ACTIVE" || currentSubscription.status === "TRIALING") &&
    currentSubscription.currentPeriodEnd &&
    new Date(currentSubscription.currentPeriodEnd) > now

  const isCurrentFree = isCurrentActive && (currentSubscription?.plan?.price === 0)
  const remainingFreeDays = isCurrentFree && currentSubscription?.currentPeriodEnd
    ? Math.max(0, Math.ceil((new Date(currentSubscription.currentPeriodEnd).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0

  const isCurrentPaidActive = isCurrentActive && !isCurrentFree

  // Verify payment status via polling
  const checkPaymentStatus = async (silent = false): Promise<boolean> => {
    if (!purchaseId) return false
    if (!silent) setIsChecking(true)

    try {
      const res = await fetch(`/api/seller/subscription/verify-payment?purchaseId=${purchaseId}`)
      const data = await res.json().catch(() => ({}))

      if (data.isReady || data.status === "ACTIVE" || data.status === "QUEUED") {
        stopPolling()
        setActivatedStatus(data.status === "QUEUED" ? "QUEUED" : "ACTIVE")
        setState("success")
        if (onSuccess) onSuccess()
        return true
      }

      if (data.isFailed || data.status === "FAILED") {
        stopPolling()
        setState("error")
        setError(data.message || "Payment was failed or cancelled. Please try again.")
        return true
      }

      return false
    } catch {
      return false
    } finally {
      if (!silent) setIsChecking(false)
    }
  }

  // Start polling every 3s for up to 90s
  const startPolling = (pid: string) => {
    stopPolling()
    pollIntervalRef.current = setInterval(async () => {
      await checkPaymentStatus(true)
    }, 3000)

    pollTimeoutRef.current = setTimeout(() => {
      stopPolling()
      if (state === "waiting") {
        setError(
          method === "FLOAT"
            ? "Payment confirmation timed out. If you finished payment in the Float portal, please click 'Verify Now'."
            : "Payment confirmation timed out. If you entered your PIN, please click 'Verify Now'."
        )
      }
    }, 90000)
  }

  // Initiate Push USSD payment
  const handleInitiatePayment = async () => {
    const cleanPhone = phone.trim()
    if (!cleanPhone && payablePrice > 0) {
      setError("Please enter your Africell mobile number (e.g. 033600171)")
      return
    }

    setError("")
    setState("initiating")

    try {
      const res = await fetch("/api/seller/subscription/pay-afrimoney", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          phone: cleanPhone,
          couponCode: appliedCoupon?.code,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data.success) {
        setState("error")
        setError(data.error || data.message || "Failed to initiate payment")
        return
      }

      // If instant coupon activation (0 price)
      if (data.payableAmount === 0 || !data.ftxnId) {
        setState("success")
        setActivatedStatus(data.status === "QUEUED" ? "QUEUED" : "ACTIVE")
        if (onSuccess) onSuccess()
        return
      }

      setPurchaseId(data.purchaseId)
      setState("waiting")
      setMessage(
        data.message ||
          "Payment prompt sent to your phone! Please enter your AfriMoney PIN to confirm."
      )
      startPolling(data.purchaseId)
    } catch (err: any) {
      setState("error")
      setError(err?.message || "Could not connect to payment gateway. Please try again.")
    }
  }

  // Initiate Float Card Payment
  const handleInitiateFloatPayment = async () => {
    setError("")
    setState("initiating")

    try {
      const res = await fetch("/api/seller/subscription/pay-float", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          couponCode: appliedCoupon?.code,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data.success) {
        setState("error")
        setError(data.error || data.message || "Failed to initiate Float card payment")
        return
      }

      // If 100% coupon applied
      if (data.payableAmount === 0 || !data.paymentUrl) {
        setState("success")
        setActivatedStatus(data.status === "QUEUED" ? "QUEUED" : "ACTIVE")
        if (onSuccess) onSuccess()
        return
      }

      setPurchaseId(data.purchaseId)
      setFlotPaymentLink(data.paymentUrl)
      setState("waiting")
      setMessage("Float checkout initiated! Please finish entering your card details in the Float portal window.")

      window.open(data.paymentUrl, "_blank")
      startPolling(data.purchaseId)
    } catch (err: any) {
      setState("error")
      setError(err?.message || "Could not connect to Float gateway. Please try again.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-6 rounded-3xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-xl font-black flex items-center gap-2 text-slate-900 dark:text-white">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            Subscription Recharge
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground font-medium">
            Prepaid recharge pack for your seller store
          </DialogDescription>
        </DialogHeader>

        {/* Plan Header Card */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {plan.displayName || plan.name}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Duration: {durationDays} days pack
              </p>
            </div>
            <div className="text-right">
              {appliedCoupon ? (
                <div>
                  <span className="line-through text-xs text-slate-400 font-bold mr-1.5">
                    {formatCurrency(plan.price)}
                  </span>
                  <span className="text-lg font-black text-emerald-600">
                    {formatCurrency(payablePrice)}
                  </span>
                </div>
              ) : (
                <span className="text-lg font-black text-slate-900 dark:text-white">
                  {formatCurrency(plan.price)}
                </span>
              )}
            </div>
          </div>

          {/* Decision G Carry-Forward Banner */}
          {remainingFreeDays > 0 && (
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
              <Gift className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                <span>Free Trial Carry-Forward Offer: </span>
                <span className="font-normal">
                  Your remaining <strong>{remainingFreeDays} free days</strong> will be stacked onto this pack!
                  (Total new validity: <strong>{remainingFreeDays + durationDays} days</strong>)
                </span>
              </div>
            </div>
          )}

          {/* Active Paid Pack Queue Notice */}
          {isCurrentPaidActive && (
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-start gap-2">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
              <div className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                <span>Queued Recharge: </span>
                <span className="font-normal">
                  Your current active pack ends on{" "}
                  <strong>{new Date(currentSubscription!.currentPeriodEnd!).toLocaleDateString()}</strong>.
                  This recharge will be <strong>queued</strong> and start automatically when your current pack ends.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* State 1: IDLE / INITIATING */}
        {(state === "idle" || state === "initiating") && (
          <div className="space-y-4 pt-2">
            {payablePrice > 0 && (
              <Tabs
                value={method}
                onValueChange={(val) => setMethod(val as "AFRIMONEY" | "FLOAT")}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2 h-11 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <TabsTrigger
                    value="AFRIMONEY"
                    className="flex items-center gap-1.5 font-bold text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-sm"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    AfriMoney (Push USSD)
                  </TabsTrigger>
                  <TabsTrigger
                    value="FLOAT"
                    className="flex items-center gap-1.5 font-bold text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Float (Card / Online)
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            {method === "AFRIMONEY" ? (
              payablePrice > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-slate-500" />
                    Africell Mobile Number (AfriMoney)
                  </label>
                  <Input
                    type="tel"
                    placeholder="e.g. 033600171 or 077..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={state === "initiating"}
                    className="h-11 rounded-xl"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    AfriMoney Push USSD will prompt you on this phone to enter your PIN.
                  </p>
                </div>
              )
            ) : (
              payablePrice > 0 && (
                <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      Float Hosted Checkout
                    </span>
                    <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700 bg-blue-100/50 dark:bg-blue-950">
                      Debit / Credit Card
                    </Badge>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                    Clicking below will open Float's secure payment portal where you can pay using any local or international card.
                  </p>
                </div>
              )
            )}

            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {method === "AFRIMONEY" ? (
              <Button
                className="w-full h-12 rounded-xl font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-600/20"
                disabled={state === "initiating"}
                onClick={handleInitiatePayment}
              >
                {state === "initiating" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending Push USSD...
                  </>
                ) : payablePrice === 0 ? (
                  "Activate Now (Free with Coupon)"
                ) : (
                  `Pay ${formatCurrency(payablePrice)} via AfriMoney`
                )}
              </Button>
            ) : (
              <Button
                className="w-full h-12 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20"
                disabled={state === "initiating"}
                onClick={handleInitiateFloatPayment}
              >
                {state === "initiating" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Opening Float Portal...
                  </>
                ) : payablePrice === 0 ? (
                  "Activate Now (Free with Coupon)"
                ) : (
                  `Proceed to Float Card Checkout • ${formatCurrency(payablePrice)}`
                )}
              </Button>
            )}
          </div>
        )}

        {/* State 2: WAITING / POLLING */}
        {state === "waiting" && (
          <div className="py-6 space-y-5 text-center">
            <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
              <div className="relative w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                {method === "FLOAT" ? (
                  <CreditCard className="w-6 h-6 animate-pulse text-blue-600" />
                ) : (
                  <Smartphone className="w-6 h-6 animate-pulse text-orange-600" />
                )}
              </div>
            </div>

            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 dark:text-white text-base">
                {method === "FLOAT" ? "Float Checkout in Progress" : "USSD Prompt Sent!"}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                {message ||
                  (method === "FLOAT"
                    ? "Please complete your card details in the Float portal window."
                    : "Please check your phone screen and enter your AfriMoney PIN to confirm payment.")}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
              <span>Waiting for payment confirmation (checking every 3s)...</span>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 flex items-center gap-2 text-left">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              {method === "FLOAT" && flotPaymentLink ? (
                <Button
                  variant="outline"
                  className="w-1/2 h-11 rounded-xl font-bold text-xs"
                  onClick={() => window.open(flotPaymentLink, "_blank")}
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Re-open Portal
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="w-1/2 h-11 rounded-xl font-bold text-xs"
                  onClick={() => {
                    stopPolling()
                    setState("idle")
                  }}
                >
                  Change Details
                </Button>
              )}
              <Button
                variant="default"
                className="w-1/2 h-11 rounded-xl font-bold text-xs bg-slate-900 text-white"
                disabled={isChecking}
                onClick={() => checkPaymentStatus(false)}
              >
                {isChecking ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Verify Now
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* State 3: SUCCESS */}
        {state === "success" && (
          <div className="py-6 space-y-5 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h4 className="font-black text-slate-900 dark:text-white text-lg">
                {activatedStatus === "QUEUED" ? "Recharge Queued!" : "Recharge Successful!"}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {activatedStatus === "QUEUED"
                  ? "Your pack has been safely queued. It will activate automatically as soon as your current subscription expires."
                  : "Your plan is now active! Your store listings are live and visible to customers on both Web and Mobile apps."}
              </p>
            </div>

            <Button
              className="w-full h-11 rounded-xl font-bold bg-slate-900 text-white hover:bg-slate-800"
              onClick={() => {
                onOpenChange(false)
                if (onSuccess) onSuccess()
              }}
            >
              Done
            </Button>
          </div>
        )}

        {/* State 4: ERROR */}
        {state === "error" && (
          <div className="py-6 space-y-5 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-red-100 dark:bg-red-950/60 flex items-center justify-center text-red-600 dark:text-red-400">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h4 className="font-black text-slate-900 dark:text-white text-base">
                Payment Failed or Cancelled
              </h4>
              <p className="text-xs text-red-600 dark:text-red-400 max-w-sm mx-auto">
                {error || "We could not confirm your payment. Please try again."}
              </p>
            </div>

            <Button
              variant="default"
              className="w-full h-11 rounded-xl font-bold bg-slate-900 text-white hover:bg-slate-800"
              onClick={() => {
                setError("")
                setState("idle")
              }}
            >
              Try Again
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
