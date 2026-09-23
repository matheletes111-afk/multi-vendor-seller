"use client"

import { useState } from "react"
import { Button } from "@/ui/button"
import { CreditCard, RefreshCw } from "lucide-react"

export interface PayNowButtonProps {
  adId: string
  paymentStatus: string
  flotPaymentLink?: string | null
  onStatusChanged?: () => void
  size?: "sm" | "default" | "lg"
  className?: string
}

export function PayNowButton({
  adId,
  paymentStatus,
  flotPaymentLink,
  onStatusChanged,
  size = "sm",
  className = "",
}: PayNowButtonProps) {
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)

  if (paymentStatus === "COMPLETED") {
    return null
  }

  const handlePayNow = async () => {
    // If existing payment link exists, open directly
    if (flotPaymentLink) {
      window.open(flotPaymentLink, "_blank")
      return
    }

    // Otherwise refresh / request fresh payment link
    setLoading(true)
    try {
      const res = await fetch(`/api/seller/ads/${adId}/verify-payment?refresh=true`, {
        method: "POST",
      })
      const data = await res.json().catch(() => ({}))
      if (data.paymentUrl) {
        window.open(data.paymentUrl, "_blank")
      } else if (data.paid && onStatusChanged) {
        onStatusChanged()
      } else {
        alert(data.error || "Failed to generate payment link. Please try again.")
      }
    } catch (err: any) {
      alert(err?.message || "Payment service unavailable")
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setVerifying(true)
    try {
      const res = await fetch(`/api/seller/ads/${adId}/verify-payment`)
      const data = await res.json().catch(() => ({}))
      if (data.paid) {
        if (onStatusChanged) onStatusChanged()
      } else {
        alert(data.paid ? "Payment verified!" : "Payment is still pending. If you just paid, please allow a few seconds and try again.")
      }
    } catch {
      alert("Could not verify status. Please check your internet connection.")
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <Button
        size={size}
        variant="default"
        onClick={handlePayNow}
        disabled={loading || verifying}
        className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm h-8 px-2.5"
      >
        {loading ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
        ) : (
          <CreditCard className="w-3.5 h-3.5 mr-1" />
        )}
        Pay Now
      </Button>

      <Button
        size="icon"
        variant="outline"
        onClick={handleVerify}
        disabled={verifying || loading}
        title="Check payment status with Float"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${verifying ? "animate-spin text-primary" : ""}`} />
      </Button>
    </div>
  )
}
