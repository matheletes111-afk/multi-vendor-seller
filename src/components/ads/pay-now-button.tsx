"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Badge } from "@/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/ui/tabs"
import { formatCurrency } from "@/lib/utils"
import {
  CreditCard,
  RefreshCw,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  PhoneCall,
  Loader2,
} from "lucide-react"

export interface PayNowButtonProps {
  adId: string
  paymentStatus: string
  flotPaymentLink?: string | null
  adTitle?: string
  amount?: number | null
  onStatusChanged?: () => void
  size?: "sm" | "default" | "lg"
  className?: string
}

export function PayNowButton({
  adId,
  paymentStatus,
  flotPaymentLink,
  adTitle,
  amount,
  onStatusChanged,
  size = "sm",
  className = "",
}: PayNowButtonProps) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"afrimoney" | "flot">("afrimoney")

  // Ad details state (fetched if not passed as props)
  const [displayTitle, setDisplayTitle] = useState(adTitle || "")
  const [displayAmount, setDisplayAmount] = useState<number | null>(
    amount !== undefined ? amount : null
  )

  // AfriMoney state
  const [phone, setPhone] = useState("")
  const [afriState, setAfriState] = useState<
    "idle" | "initiating" | "waiting" | "success" | "error"
  >("idle")
  const [afriMessage, setAfriMessage] = useState("")
  const [afriError, setAfriError] = useState("")
  const [isCheckingAfri, setIsCheckingAfri] = useState(false)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Float state
  const [flotLoading, setFlotLoading] = useState(false)
  const [flotVerifying, setFlotVerifying] = useState(false)

  // Cleanup polling timers on unmount or dialog close
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

  // When dialog opens, optionally load ad info if amount/title not supplied
  useEffect(() => {
    if (!open) {
      stopPolling()
      if (afriState !== "success") {
        setAfriState("idle")
        setAfriError("")
      }
      return
    }

    if (adTitle) setDisplayTitle(adTitle)
    if (amount !== undefined) setDisplayAmount(amount)

    // Fetch ad info if missing
    if (!adTitle || amount === undefined) {
      fetch(`/api/seller/ads/${adId}/pay-afrimoney`)
        .then((res) => res.json())
        .then((data) => {
          if (data.title && !adTitle) setDisplayTitle(data.title)
          if (data.payableAmount != null && amount === undefined) {
            setDisplayAmount(Number(data.payableAmount))
          }
        })
        .catch(() => {})
    }
  }, [open, adId, adTitle, amount])

  if (paymentStatus === "COMPLETED") {
    return null
  }

  // Poll AfriMoney payment status
  const checkAfriPaymentStatus = async (silent = false): Promise<boolean> => {
    if (!silent) setIsCheckingAfri(true)
    try {
      const res = await fetch(`/api/seller/ads/${adId}/pay-afrimoney`)
      const data = await res.json().catch(() => ({}))

      if (data.paid || data.paymentStatus === "COMPLETED") {
        stopPolling()
        setAfriState("success")
        if (onStatusChanged) onStatusChanged()
        return true
      }
      return false
    } catch {
      return false
    } finally {
      if (!silent) setIsCheckingAfri(false)
    }
  }

  // Start polling every 3 seconds for up to 90 seconds
  const startAfriPolling = () => {
    stopPolling()
    pollIntervalRef.current = setInterval(async () => {
      const isPaid = await checkAfriPaymentStatus(true)
      if (isPaid) {
        stopPolling()
      }
    }, 3000)

    // Stop polling after 90 seconds
    pollTimeoutRef.current = setTimeout(() => {
      stopPolling()
    }, 90000)
  }

  // Initiate AfriMoney Push USSD
  const handleInitiateAfriMoney = async () => {
    const cleanPhone = phone.trim()
    if (!cleanPhone) {
      setAfriError("Please enter your Africell mobile number (e.g. 033600171)")
      return
    }

    setAfriError("")
    setAfriState("initiating")

    try {
      const res = await fetch(`/api/seller/ads/${adId}/pay-afrimoney`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data.success) {
        setAfriState("error")
        setAfriError(data.error || data.message || "Failed to initiate AfriMoney prompt")
        return
      }

      setAfriState("waiting")
      setAfriMessage(
        data.message ||
          "Payment prompt sent to your phone! Please enter your AfriMoney PIN to confirm."
      )
      startAfriPolling()
    } catch (err: any) {
      setAfriState("error")
      setAfriError(err?.message || "Could not connect to payment gateway. Please try again.")
    }
  }

  // Handle Float Checkout
  const handleFloatPay = async () => {
    if (flotPaymentLink) {
      window.open(flotPaymentLink, "_blank")
      return
    }

    setFlotLoading(true)
    try {
      const res = await fetch(`/api/seller/ads/${adId}/verify-payment?refresh=true`, {
        method: "POST",
      })
      const data = await res.json().catch(() => ({}))
      if (data.paymentUrl) {
        window.open(data.paymentUrl, "_blank")
      } else if (data.paid && onStatusChanged) {
        onStatusChanged()
        setOpen(false)
      } else {
        alert(data.error || "Failed to generate Float payment link. Please try again.")
      }
    } catch (err: any) {
      alert(err?.message || "Payment service unavailable")
    } finally {
      setFlotLoading(false)
    }
  }

  // Quick verify outside modal
  const handleQuickVerify = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setFlotVerifying(true)
    try {
      // Check AfriMoney status first
      const afriRes = await fetch(`/api/seller/ads/${adId}/pay-afrimoney`)
      const afriData = await afriRes.json().catch(() => ({}))
      if (afriData.paid) {
        if (onStatusChanged) onStatusChanged()
        alert("Payment verified successfully!")
        return
      }

      // Check Float status
      const res = await fetch(`/api/seller/ads/${adId}/verify-payment`)
      const data = await res.json().catch(() => ({}))
      if (data.paid) {
        if (onStatusChanged) onStatusChanged()
        alert("Payment verified successfully!")
      } else {
        alert(
          "Payment is still pending. If you just approved the transaction on your phone, please allow a few seconds and try again."
        )
      }
    } catch {
      alert("Could not verify status. Please check your internet connection.")
    } finally {
      setFlotVerifying(false)
    }
  }

  return (
    <>
      <div className={`inline-flex items-center gap-1.5 ${className}`}>
        <Button
          size={size}
          variant="default"
          onClick={() => setOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm h-8 px-2.5"
        >
          <CreditCard className="w-3.5 h-3.5 mr-1" />
          Pay Now
        </Button>

        <Button
          size="icon"
          variant="outline"
          onClick={handleQuickVerify}
          disabled={flotVerifying}
          title="Refresh / Verify payment status"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${flotVerifying ? "animate-spin text-primary" : ""}`}
          />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px] p-6">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Pay for Ad Campaign
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {displayTitle ? `Ad: "${displayTitle}"` : "Choose a payment method to activate your ad."}
            </DialogDescription>
          </DialogHeader>

          {/* Amount Badge Banner */}
          {displayAmount !== null && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
              <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                Total Payable Amount
              </span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                {formatCurrency(displayAmount)}
              </span>
            </div>
          )}

          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as "afrimoney" | "flot")}
            className="w-full mt-2"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="afrimoney" className="flex items-center gap-1.5 font-semibold text-xs">
                <Smartphone className="w-3.5 h-3.5 text-orange-500" />
                AfriMoney (Push USSD)
              </TabsTrigger>
              <TabsTrigger value="flot" className="flex items-center gap-1.5 font-semibold text-xs">
                <CreditCard className="w-3.5 h-3.5 text-blue-500" />
                Float (Card / Online)
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: AfriMoney Push USSD */}
            <TabsContent value="afrimoney" className="space-y-4 pt-3">
              {afriState === "success" ? (
                <div className="p-5 text-center rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-3">
                  <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-emerald-900 dark:text-emerald-100">
                      Payment Completed!
                    </h4>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                      Your AfriMoney transaction was successful and your ad campaign is now active.
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setOpen(false)
                      if (onStatusChanged) onStatusChanged()
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Done
                  </Button>
                </div>
              ) : afriState === "waiting" ? (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center text-amber-600 shrink-0 mt-0.5">
                      <PhoneCall className="w-4 h-4 animate-pulse" />
                    </div>
                    <div className="flex-1 text-xs">
                      <p className="font-bold text-amber-900 dark:text-amber-100 text-sm">
                        USSD Prompt Sent!
                      </p>
                      <p className="text-amber-700 dark:text-amber-300 mt-1 leading-relaxed">
                        Please check your phone screen ({phone}) and enter your AfriMoney PIN to authorize payment.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-amber-200 dark:border-amber-800/60">
                    <div className="flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-200">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                      <span>Waiting for PIN authorization...</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => checkAfriPaymentStatus(false)}
                      disabled={isCheckingAfri}
                      className="text-xs h-7 px-2 border-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                    >
                      <RefreshCw
                        className={`w-3 h-3 mr-1 ${isCheckingAfri ? "animate-spin" : ""}`}
                      />
                      Check Status
                    </Button>
                  </div>

                  <div className="pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        stopPolling()
                        setAfriState("idle")
                      }}
                      className="text-xs text-muted-foreground w-full h-7"
                    >
                      Change phone number / Send again
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    Enter your Africell number. A secure Push USSD prompt will pop up on your mobile handset immediately.
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>Africell Phone Number</span>
                      <span className="text-[11px] text-muted-foreground font-normal">Sierra Leone (+232)</span>
                    </label>
                    <div className="relative">
                      <Input
                        type="tel"
                        placeholder="e.g. 033600171 or 077928995"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value)
                          if (afriError) setAfriError("")
                        }}
                        disabled={afriState === "initiating"}
                        className="text-sm font-medium"
                      />
                    </div>
                  </div>

                  {/* Test number quick helper */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground pt-0.5">
                    <span>Quick test:</span>
                    <button
                      type="button"
                      onClick={() => setPhone("033600171")}
                      className="px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-[11px] font-mono transition-colors"
                    >
                      033600171
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhone("077928995")}
                      className="px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-[11px] font-mono transition-colors"
                    >
                      077928995
                    </button>
                  </div>

                  {afriError && (
                    <div className="flex items-center gap-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{afriError}</span>
                    </div>
                  )}

                  <Button
                    onClick={handleInitiateAfriMoney}
                    disabled={afriState === "initiating" || !phone.trim()}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm h-10 shadow-sm"
                  >
                    {afriState === "initiating" ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Sending Push USSD to Phone...
                      </>
                    ) : (
                      <>
                        <Smartphone className="w-4 h-4 mr-2" />
                        Send USSD Payment Prompt
                      </>
                    )}
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* TAB 2: Float Checkout */}
            <TabsContent value="flot" className="space-y-4 pt-3">
              <div className="text-xs text-muted-foreground leading-relaxed">
                Pay using debit/credit cards or other supported payment methods through the Float Checkout gateway.
              </div>

              <div className="p-3.5 rounded-lg border bg-muted/40 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">Float Secure Checkout</span>
                  <Badge variant="outline" className="text-[10px]">Cards & Online</Badge>
                </div>
                <p className="text-muted-foreground">
                  You will be redirected to the secure Float payment portal to complete your transaction.
                </p>
              </div>

              <div className="space-y-2">
                <Button
                  onClick={handleFloatPay}
                  disabled={flotLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm h-10"
                >
                  {flotLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Opening Float Checkout...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open Float Payment Portal
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={async () => {
                    setFlotVerifying(true)
                    try {
                      const res = await fetch(`/api/seller/ads/${adId}/verify-payment`)
                      const data = await res.json().catch(() => ({}))
                      if (data.paid) {
                        if (onStatusChanged) onStatusChanged()
                        alert("Float payment verified successfully!")
                        setOpen(false)
                      } else {
                        alert("Payment is still pending. If you just completed checkout, please wait a moment and try again.")
                      }
                    } catch {
                      alert("Could not verify status.")
                    } finally {
                      setFlotVerifying(false)
                    }
                  }}
                  disabled={flotVerifying}
                  className="w-full text-xs h-9"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 mr-1.5 ${flotVerifying ? "animate-spin" : ""}`}
                  />
                  Verify Float Payment Status
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  )
}
