"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Package,
  MapPin,
  CheckCircle2,
  Clock,
  Bike,
  ArrowLeft,
  Phone,
  Store,
  Navigation,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Check,
  Upload,
  Camera,
  ImageIcon,
} from "lucide-react"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { Input } from "@/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { cn } from "@/lib/utils"

export function RiderOrderDeliveryClient({ assignmentId }: { assignmentId: string }) {
  const router = useRouter()
  const [assignment, setAssignment] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // OTP Modal State
  const [otpModalOpen, setOtpModalOpen] = useState(false)
  const [otpInput, setOtpInput] = useState("")
  const [otpError, setOtpError] = useState<string | null>(null)
  const [proofImageBase64, setProofImageBase64] = useState<string | null>(null)

  // Cancel Modal State
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState("Vehicle breakdown")

  const fetchDetail = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/riderapp/orders/${assignmentId}`)
      const data = await res.json()
      if (res.ok) {
        setAssignment(data.assignment)
      } else {
        setError(data.error || "Failed to load assignment")
      }
    } catch (err: any) {
      setError(err?.message || "Network error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDetail()
  }, [assignmentId])

  const handleUpdateStatus = async (
    nextStatus: string,
    extraData?: { otp?: string; cancellationReason?: string; proofImage?: string }
  ) => {
    try {
      setActionLoading(true)
      const res = await fetch(`/api/riderapp/orders/${assignmentId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          otp: extraData?.otp,
          proofImage: extraData?.proofImage ?? proofImageBase64,
          cancellationReason: extraData?.cancellationReason,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        if (nextStatus === "DELIVERED") {
          setOtpModalOpen(false)
          setProofImageBase64(null)
        }
        if (nextStatus === "CANCELLED_BY_RIDER") {
          setCancelModalOpen(false)
          router.push("/riderapp/orders")
          return
        }
        fetchDetail()
      } else {
        if (nextStatus === "DELIVERED") {
          setOtpError(data.error || "Invalid Delivery OTP")
        } else {
          alert(data.error || "Failed to update status")
        }
      }
    } catch (err: any) {
      alert(err?.message || "Network error")
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
        Loading delivery details...
      </div>
    )
  }

  if (error || !assignment) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Link href="/riderapp/orders">
          <Button variant="ghost" size="sm" className="rounded-xl text-xs gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Back to Orders
          </Button>
        </Link>
        <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-600">
          {error || "Assignment not found"}
        </div>
      </div>
    )
  }

  const order = assignment.order
  const shopName =
    order?.seller?.store?.name ||
    order?.seller?.businessInfo?.businessName ||
    "Seller Store"
  const shopPhone =
    order?.seller?.user?.phone ||
    order?.seller?.businessInfo?.pocContact ||
    ""
  const shopAddress = [
    order?.seller?.businessInfo?.street,
    order?.seller?.businessInfo?.city,
  ]
    .filter(Boolean)
    .join(", ")
  const shopLat = order?.seller?.businessInfo?.latitude || assignment.sellerLatitude
  const shopLng = order?.seller?.businessInfo?.longitude || assignment.sellerLongitude

  const customerName = order?.shippingFullName || order?.customer?.name || "Customer"
  const customerPhone = order?.shippingPhone || order?.customer?.phone || ""
  const dropAddress = [
    order?.shippingAddressLine1,
    order?.shippingAddressLine2,
    order?.shippingCity,
    order?.shippingPostalCode,
  ]
    .filter(Boolean)
    .join(", ")

  const isDelivered = assignment.status === "DELIVERED"
  const isCancelled = assignment.status === "CANCELLED_BY_RIDER"

  // Google Maps Deep Links
  const shopMapsUrl =
    shopLat && shopLng
      ? `https://www.google.com/maps/dir/?api=1&destination=${shopLat},${shopLng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shopAddress || shopName)}`

  const dropMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dropAddress || customerName)}`

  // Status Stepper
  const steps = [
    { key: "ACCEPTED", label: "Offer Accepted" },
    { key: "AT_PICKUP", label: "At Store" },
    { key: "PICKED_UP", label: "Picked Up" },
    { key: "OUT_FOR_DELIVERY", label: "Out For Delivery" },
    { key: "DELIVERED", label: "Delivered" },
  ]

  const currentStepIdx = steps.findIndex((s) => s.key === assignment.status)

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Back Button & Header */}
      <div className="flex items-center justify-between gap-4">
        <Link href="/riderapp/orders">
          <Button variant="ghost" size="sm" className="rounded-xl text-xs gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Back to Orders
          </Button>
        </Link>
        <Badge
          className={cn(
            "text-xs font-bold px-3 py-1 rounded-full uppercase",
            isDelivered
              ? "bg-green-600 text-white"
              : isCancelled
              ? "bg-red-600 text-white"
              : "bg-blue-600 text-white"
          )}
        >
          {assignment.status.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Main Order Header Card */}
      <div className="p-6 rounded-3xl border border-border/80 bg-card space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/80">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              Order #{order?.orderNumber || assignment.orderId.slice(-6)}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Assigned via {assignment.dispatchMode?.replace(/_/g, " ")} • Attempt #{assignment.attemptNumber}
            </p>
          </div>
          {assignment.distanceKm && (
            <Badge variant="outline" className="text-xs rounded-xl px-3 py-1 self-start sm:self-auto">
              {assignment.distanceKm} km from store
            </Badge>
          )}
        </div>

        {/* Milestone Stepper */}
        {!isCancelled && (
          <div className="py-2">
            <div className="flex items-center justify-between relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-muted w-full z-0" />
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-blue-600 transition-all duration-300 z-0"
                style={{
                  width: `${Math.max(0, (currentStepIdx / (steps.length - 1)) * 100)}%`,
                }}
              />
              {steps.map((step, idx) => {
                const isPassed = currentStepIdx >= idx
                const isCurrent = currentStepIdx === idx
                return (
                  <div key={step.key} className="flex flex-col items-center relative z-10">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all border-2",
                        isPassed
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "bg-background border-muted-foreground/30 text-muted-foreground",
                        isCurrent && "ring-4 ring-blue-600/20"
                      )}
                    >
                      {isPassed ? <Check className="w-4 h-4" /> : idx + 1}
                    </div>
                    <span
                      className={cn(
                        "text-[10px] mt-1.5 hidden sm:block font-medium",
                        isCurrent
                          ? "text-blue-600 font-bold"
                          : isPassed
                          ? "text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Pickup & Drop Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pickup: Store */}
        <div className="p-5 rounded-3xl border border-border/80 bg-card space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-xs text-foreground uppercase tracking-wider">
              <Store className="w-4 h-4 text-blue-600" />
              1. Pickup Location
            </div>
            {shopPhone && (
              <a href={`tel:${shopPhone}`}>
                <Button variant="outline" size="sm" className="h-8 text-xs rounded-xl gap-1">
                  <Phone className="w-3.5 h-3.5 text-blue-600" /> Call
                </Button>
              </a>
            )}
          </div>

          <div className="space-y-1 text-xs">
            <div className="font-bold text-foreground text-sm">{shopName}</div>
            <div className="text-muted-foreground">{shopAddress || "Seller Location"}</div>
            {shopPhone && <div className="text-muted-foreground">Phone: {shopPhone}</div>}
          </div>

          <a href={shopMapsUrl} target="_blank" rel="noreferrer">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs rounded-xl gap-1.5 font-semibold text-blue-600 border-blue-200 dark:border-blue-900"
            >
              <Navigation className="w-3.5 h-3.5" /> Navigate to Store (Google Maps)
            </Button>
          </a>
        </div>

        {/* Drop: Customer */}
        <div className="p-5 rounded-3xl border border-border/80 bg-card space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-xs text-foreground uppercase tracking-wider">
              <MapPin className="w-4 h-4 text-emerald-600" />
              2. Drop-off Location
            </div>
            {customerPhone && (
              <a href={`tel:${customerPhone}`}>
                <Button variant="outline" size="sm" className="h-8 text-xs rounded-xl gap-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" /> Call
                </Button>
              </a>
            )}
          </div>

          <div className="space-y-1 text-xs">
            <div className="font-bold text-foreground text-sm">{customerName}</div>
            <div className="text-muted-foreground">{dropAddress || "Customer Delivery Address"}</div>
            {customerPhone && <div className="text-muted-foreground">Phone: {customerPhone}</div>}
          </div>

          <a href={dropMapsUrl} target="_blank" rel="noreferrer">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs rounded-xl gap-1.5 font-semibold text-emerald-600 border-emerald-200 dark:border-emerald-900"
            >
              <Navigation className="w-3.5 h-3.5" /> Navigate to Customer
            </Button>
          </a>
        </div>
      </div>

      {/* Package Items & Payment Summary */}
      <div className="p-5 rounded-3xl border border-border/80 bg-card space-y-4 shadow-xs">
        <h3 className="font-bold text-xs text-foreground uppercase tracking-wider flex items-center gap-2">
          <Package className="w-4 h-4 text-blue-600" />
          Package Items Snapshot
        </h3>

        <div className="divide-y divide-border/60">
          {order?.items?.map((item: any) => (
            <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
              <div>
                <div className="font-semibold text-foreground">
                  {item.productNameSnapshot || item.product?.name || "Product Item"}
                </div>
                <div className="text-[11px] text-muted-foreground">Qty: {item.quantity || 1}</div>
              </div>
              <div className="font-semibold text-foreground">
                Le {Number(item.price || 0).toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-border/80 space-y-2 text-xs font-bold">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Customer Order Total</span>
            <span className="text-foreground">
              Le {Number(order?.totalAmount || 0).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300">
            <span>Your Delivery Fee Earning</span>
            <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
              Le {Number(order?.shipping || order?.items?.reduce((s: number, i: any) => s + (i.shippingAmount || 0), 0) || 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Primary Action Workflow Bar */}
      {!isDelivered && !isCancelled && (
        <div className="p-5 rounded-3xl border border-border/80 bg-card space-y-3 shadow-xs">
          <div className="font-bold text-xs text-foreground uppercase tracking-wider">
            Current Action Required:
          </div>

          {assignment.status === "ACCEPTED" && (
            <Button
              onClick={() => handleUpdateStatus("AT_PICKUP")}
              disabled={actionLoading}
              className="w-full h-12 rounded-2xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-md"
            >
              <Store className="w-4 h-4" /> I Have Arrived at Store
            </Button>
          )}

          {assignment.status === "AT_PICKUP" && (
            <Button
              onClick={() => handleUpdateStatus("PICKED_UP")}
              disabled={actionLoading}
              className="w-full h-12 rounded-2xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-md"
            >
              <Package className="w-4 h-4" /> Packages Collected & Verified
            </Button>
          )}

          {assignment.status === "PICKED_UP" && (
            <Button
              onClick={() => handleUpdateStatus("OUT_FOR_DELIVERY")}
              disabled={actionLoading}
              className="w-full h-12 rounded-2xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-md"
            >
              <Bike className="w-4 h-4" /> Start Delivery Journey (Out For Delivery)
            </Button>
          )}

          {assignment.status === "OUT_FOR_DELIVERY" && (
            <Button
              onClick={() => {
                setOtpError(null)
                setOtpInput("")
                setOtpModalOpen(true)
              }}
              disabled={actionLoading}
              className="w-full h-12 rounded-2xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-md"
            >
              <ShieldCheck className="w-4 h-4" /> Complete Delivery (Verify Customer OTP)
            </Button>
          )}

          {/* Emergency Cancellation Option */}
          <div className="pt-2 text-center">
            <button
              onClick={() => setCancelModalOpen(true)}
              className="text-xs text-red-600 hover:underline font-semibold"
            >
              Cancel Delivery (Emergency / Issue)
            </button>
          </div>
        </div>
      )}

      {/* Completed Banner */}
      {isDelivered && (
        <div className="p-6 rounded-3xl bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 text-center space-y-2">
          <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto" />
          <h3 className="text-base font-bold text-green-800 dark:text-green-300">
            Delivery Successfully Completed!
          </h3>
          <p className="text-xs text-green-700 dark:text-green-400">
            Customer OTP verified and order marked as delivered.
          </p>
        </div>
      )}

      {/* Customer OTP Dialog */}
      <Dialog open={otpModalOpen} onOpenChange={setOtpModalOpen}>
        <DialogContent className="rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Customer Delivery OTP
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ask the customer for their 6-digit delivery OTP code to confirm handover.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                1. Enter 6-Digit OTP:
              </label>
              <Input
                type="text"
                maxLength={6}
                placeholder="e.g. 582910"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.trim())}
                className="text-center text-xl font-mono tracking-widest h-12 rounded-2xl"
              />
              {otpError && (
                <div className="text-[11px] text-red-600 font-semibold text-center">
                  {otpError}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center justify-between">
                <span>2. Delivery Proof Photo:</span>
                <span className="text-[10px] text-muted-foreground font-normal">(Optional)</span>
              </label>

              <input
                type="file"
                accept="image/*"
                capture="environment"
                id="rider-proof-upload"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    const reader = new FileReader()
                    reader.onload = () => setProofImageBase64(reader.result as string)
                    reader.readAsDataURL(file)
                  }
                }}
              />

              {proofImageBase64 ? (
                <div className="relative rounded-2xl overflow-hidden border border-emerald-500/40 bg-emerald-50/10 p-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src={proofImageBase64} alt="Proof preview" className="w-10 h-10 object-cover rounded-xl border" />
                    <span className="text-xs font-semibold text-emerald-600">Photo Attached</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setProofImageBase64(null)}
                    className="text-xs text-red-600 h-8 px-2"
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("rider-proof-upload")?.click()}
                  className="w-full h-10 rounded-2xl text-xs gap-2 border-dashed border-2"
                >
                  <Camera className="w-4 h-4 text-muted-foreground" />
                  Take Photo / Upload Delivery Proof
                </Button>
              )}
            </div>
          </div>

          <DialogFooter className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => setOtpModalOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleUpdateStatus("DELIVERED", { otp: otpInput })}
              disabled={actionLoading || otpInput.length !== 6}
              className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {actionLoading ? "Verifying..." : "Verify & Complete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Emergency Cancellation Dialog */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Cancel Delivery
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cancelling will immediately reassign this delivery to the next nearest rider.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-2">
            <label className="text-xs font-semibold text-foreground">Select Reason:</label>
            <select
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full h-10 px-3 text-xs rounded-xl border border-input bg-background"
            >
              <option value="Vehicle breakdown">Vehicle breakdown</option>
              <option value="Personal emergency">Personal emergency</option>
              <option value="Store was closed">Store was closed</option>
              <option value="Severe weather / impassable road">Severe weather / impassable road</option>
            </select>
          </div>

          <DialogFooter className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => setCancelModalOpen(false)}
              className="rounded-xl text-xs"
            >
              Keep Delivery
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                handleUpdateStatus("CANCELLED_BY_RIDER", {
                  cancellationReason: cancelReason,
                })
              }
              disabled={actionLoading}
              className="rounded-xl text-xs font-bold"
            >
              {actionLoading ? "Cancelling..." : "Confirm Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
