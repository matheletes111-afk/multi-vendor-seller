"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/ui/card"
import { Button } from "@/ui/button"
import { CheckCircle2, Clock, AlertTriangle, ArrowRight, RefreshCw, LayoutDashboard } from "lucide-react"

function PaymentReturnContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const adId = searchParams.get("adId") || ""
  const orderId = searchParams.get("orderId") || ""
  const panel = searchParams.get("panel") || "product-seller"

  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<"COMPLETED" | "PENDING" | "FAILED" | "UNKNOWN">("UNKNOWN")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const dashboardHref =
    panel === "service-seller"
      ? "/service-seller/admanagement"
      : panel === "hotel-seller"
      ? "/hotel-seller/admanagement"
      : panel === "restaurant-seller"
      ? "/restaurant-seller/admanagement"
      : panel === "customer"
      ? "/customer/admanagement"
      : "/product-seller/admanagement"

  const checkStatus = async () => {
    if (!adId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/seller/ads/${adId}/verify-payment`)
      const data = await res.json().catch(() => ({}))

      if (data.paid || data.paymentStatus === "COMPLETED") {
        setStatus("COMPLETED")
      } else if (data.paymentStatus === "FAILED") {
        setStatus("FAILED")
      } else {
        setStatus("PENDING")
      }
    } catch (err: any) {
      setErrorMessage("Could not verify payment with server.")
      setStatus("PENDING")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkStatus()
    // Poll once more after 3 seconds in case webhook/gateway has minor latency
    const timer = setTimeout(() => {
      checkStatus()
    }, 3500)

    return () => clearTimeout(timer)
  }, [adId])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-xl border-slate-200 dark:border-slate-800 backdrop-blur-sm">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex items-center justify-center">
            {loading ? (
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
            ) : status === "COMPLETED" ? (
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 ring-8 ring-emerald-50 dark:ring-emerald-900/20">
                <CheckCircle2 className="w-9 h-9" />
              </div>
            ) : status === "FAILED" ? (
              <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400 ring-8 ring-rose-50 dark:ring-rose-900/20">
                <AlertTriangle className="w-9 h-9" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400 ring-8 ring-amber-50 dark:ring-amber-900/20">
                <Clock className="w-9 h-9" />
              </div>
            )}
          </div>

          <CardTitle className="text-xl font-bold tracking-tight">
            {loading
              ? "Verifying Payment..."
              : status === "COMPLETED"
              ? "Payment Successful!"
              : status === "FAILED"
              ? "Payment Unsuccessful"
              : "Payment Processing"}
          </CardTitle>

          <CardDescription className="text-sm mt-1">
            {loading
              ? "Confirming transaction with Float Payment Gateway..."
              : status === "COMPLETED"
              ? "Your advertisement payment was received and your ad has been submitted for admin approval."
              : status === "FAILED"
              ? "Float reported that the payment attempt was not completed. You can try paying again from your ad list."
              : "Your payment is currently being processed. It will be verified shortly."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          <div className="bg-slate-100 dark:bg-slate-900/80 rounded-lg p-3 text-xs space-y-1.5 border border-slate-200 dark:border-slate-800">
            {orderId && (
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Order Reference:</span>
                <span className="font-mono text-foreground font-medium">{orderId}</span>
              </div>
            )}
            {adId && (
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Ad ID:</span>
                <span className="font-mono text-foreground font-medium">{adId.slice(0, 12)}...</span>
              </div>
            )}
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Status:</span>
              <span className="font-semibold text-foreground">
                {loading ? "Checking..." : status}
              </span>
            </div>
          </div>

          {errorMessage && (
            <p className="text-xs text-rose-500 text-center font-medium">{errorMessage}</p>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-2 pt-2">
          <Button asChild className="w-full bg-primary hover:bg-primary/90 text-white font-medium shadow-md">
            <Link href={dashboardHref}>
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Go to Ad Management
            </Link>
          </Button>

          {status !== "COMPLETED" && !loading && (
            <Button
              variant="outline"
              onClick={checkStatus}
              className="w-full text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Re-check Status
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}

export default function PaymentReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
        </div>
      }
    >
      <PaymentReturnContent />
    </Suspense>
  )
}
