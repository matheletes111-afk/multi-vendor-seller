"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
  Bike,
  Phone,
  User,
  Navigation,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Radio,
  UserPlus,
  Search,
  Sparkles,
  Truck,
  BellOff,
  UserX,
  Camera,
  Maximize2,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { cn } from "@/lib/utils"
import { RadioGroup, RadioGroupItem } from "@/ui/radio-group"

import { OrderLiveTrackingMap } from "./order-live-tracking-map"

interface OrderRiderCardProps {
  orderId: string
  orderNumber?: string
  orderStatus?: string
  deliveryAssignments?: any[]
  sellerId?: string
  shippingAddress?: {
    fullName?: string | null
    phone?: string | null
    addressLine1?: string | null
    addressLine2?: string | null
    city?: string | null
    state?: string | null
    postalCode?: string | null
    country?: string | null
  }
  destinationLat?: number | null
  destinationLng?: number | null
  showLiveMap?: boolean
  canManage?: boolean
  isSelfDelivery?: boolean
  onRefresh?: () => void
}

function formatVehicleFriendly(type?: string): string {
  if (!type) return "Bike"
  if (type.includes("2_WHEELER") || type.includes("BIKE") || type.includes("CYCLE")) return "Bike / Motorbike"
  if (type.includes("3_WHEELER") || type.includes("KEKE")) return "Tricycle (Keke)"
  if (type.includes("4_WHEELER") || type.includes("CAR") || type.includes("VAN")) return "Car / Van"
  return type.replace(/_/g, " ")
}

export function OrderRiderCard({
  orderId,
  orderNumber,
  orderStatus,
  deliveryAssignments = [],
  sellerId,
  shippingAddress,
  destinationLat = null,
  destinationLng = null,
  showLiveMap = true,
  canManage = true,
  isSelfDelivery = false,
  onRefresh,
}: OrderRiderCardProps) {
  const [dispatchLoading, setDispatchLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [riders, setRiders] = useState<any[]>([])
  const [loadingRiders, setLoadingRiders] = useState(false)
  const [searchRider, setSearchRider] = useState("")
  const [selectedRiderId, setSelectedRiderId] = useState<string>("")
  const [activePackageIdx, setActivePackageIdx] = useState(0)
  const [showHistory, setShowHistory] = useState(false)
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null)

  // Find the active assignments (filter by sellerId if specified)
  const activeAssignments = deliveryAssignments.filter(
    (a) =>
      ["OFFERED", "ACCEPTED", "AT_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED"].includes(
        a.status
      ) && (!sellerId || a.sellerId === sellerId)
  )

  const priorityOrder = ["DELIVERED", "OUT_FOR_DELIVERY", "PICKED_UP", "AT_PICKUP", "ACCEPTED", "OFFERED"]
  const sortedActiveAssignments = [...activeAssignments].sort((a, b) => {
    const idxA = priorityOrder.indexOf(a.status)
    const idxB = priorityOrder.indexOf(b.status)
    return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB)
  })
  const activeAssignment = sortedActiveAssignments[activePackageIdx] || sortedActiveAssignments[0] || null

  const rider = activeAssignment?.rider
  const riderUser = rider?.user
  const isRiderOnline = Boolean(
    rider?.isOnline &&
    rider?.lastLocationUpdate &&
    (Date.now() - new Date(rider.lastLocationUpdate).getTime()) < 10 * 60 * 1000
  )
  const isDelivered = activeAssignment?.status === "DELIVERED" || orderStatus === "DELIVERED"
  const isOffered = !isDelivered && activeAssignment?.status === "OFFERED"
  const canCancelRider =
    canManage &&
    !isDelivered &&
    activeAssignment &&
    ["ACCEPTED", "AT_PICKUP"].includes(activeAssignment.status)

  const pickupPhotosList: string[] = useMemo(() => {
    if (!activeAssignment?.pickupProofPhotos) return []
    if (Array.isArray(activeAssignment.pickupProofPhotos)) return activeAssignment.pickupProofPhotos as string[]
    if (typeof activeAssignment.pickupProofPhotos === "string") {
      try {
        const parsed = JSON.parse(activeAssignment.pickupProofPhotos)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }
    return []
  }, [activeAssignment?.pickupProofPhotos])

  const targetSeller = activeAssignment?.sellerId || sellerId || undefined

  const sellerAssignments = deliveryAssignments.filter(
    (a) => !sellerId || a.sellerId === sellerId
  )
  const historicalAttempts = sellerAssignments.filter(
    (a) => ["TIMED_OUT", "REJECTED", "CANCELLED_BY_RIDER", "REASSIGNED_BY_ADMIN"].includes(a.status)
  )
  // Only count attempts in the current cascade cycle (not historical ones archived by manual reassign)
  const currentCycleHistorical = sellerAssignments.filter(
    (a) => ["TIMED_OUT", "REJECTED", "CANCELLED_BY_RIDER"].includes(a.status)
  )
  const latestAttempt = sellerAssignments[0]
  const isRecentTimeout =
    !isDelivered &&
    orderStatus !== "CANCELLED" &&
    latestAttempt &&
    latestAttempt.status === "TIMED_OUT" &&
    latestAttempt.expiresAt &&
    (Date.now() - new Date(latestAttempt.expiresAt).getTime()) < 10000

  // Determine candidate pool size from assignment notes (e.g. "(Pool: 5 riders)")
  // or dynamically from distinct riders in the current cascade cycle
  const poolNoteAssignment = sellerAssignments.find((a) => a.adminNotes?.includes("Pool:"))
  const poolMatch = poolNoteAssignment?.adminNotes?.match(/Pool:\s*(\d+)\s*riders?/i)
  const distinctRidersCount = new Set(
    currentCycleHistorical.map((a) => a.riderId).filter(Boolean)
  ).size
  const poolCount = poolMatch
    ? Math.max(1, parseInt(poolMatch[1], 10))
    : Math.max(1, distinctRidersCount)
  const totalExpectedAttempts = poolCount * 5

  const isCascadeInProgress =
    !isDelivered &&
    orderStatus !== "CANCELLED" &&
    orderStatus !== "REFUNDED" &&
    !isSelfDelivery &&
    (orderStatus === "SHIPPED" || orderStatus === "READY_FOR_PICKUP") &&
    activeAssignments.length === 0 &&
    currentCycleHistorical.length < totalExpectedAttempts

  const maxAttemptsReached =
    activeAssignments.length === 0 &&
    currentCycleHistorical.length >= totalExpectedAttempts &&
    !isRecentTimeout

  const [aiVehicleRecommendation, setAiVehicleRecommendation] = useState<any>(null)
  const [vehicleFilterMode, setVehicleFilterMode] = useState<"matched" | "all">("matched")
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  // Continuous live delivery polling:
  // Runs while order is SHIPPED / READY_FOR_PICKUP or has active delivery assignments.
  // Polls every 3.5s so all 5 waterfall cascades and live rider updates are reflected on screen in real-time.
  const isOrderDeliveryActive =
    !isDelivered &&
    orderStatus !== "CANCELLED" &&
    orderStatus !== "REFUNDED" &&
    !isSelfDelivery &&
    (orderStatus === "SHIPPED" || orderStatus === "READY_FOR_PICKUP" || activeAssignments.length > 0)

  useEffect(() => {
    if (!isOrderDeliveryActive) return

    const pollInterval = setInterval(() => {
      onRefresh?.()
    }, 3500)

    return () => clearInterval(pollInterval)
  }, [isOrderDeliveryActive, onRefresh])

  // 1-second visual countdown for active OFFERED assignment
  useEffect(() => {
    if (!isOffered || !activeAssignment?.expiresAt) {
      setSecondsLeft(null)
      return
    }

    let hasTriggeredCascade = false

    const calcSeconds = () => {
      const diff = Math.max(
        0,
        Math.floor((new Date(activeAssignment.expiresAt).getTime() - Date.now()) / 1000)
      )
      setSecondsLeft(diff)
      if (diff === 0 && !hasTriggeredCascade) {
        hasTriggeredCascade = true
        // 60-second offer expired! Auto-refresh order to advance cascade to next rider
        setTimeout(() => {
          onRefresh?.()
        }, 1500)
      }
    }
    calcSeconds()
    const timer = setInterval(calcSeconds, 1000)

    return () => clearInterval(timer)
  }, [isOffered, activeAssignment?.id, activeAssignment?.expiresAt, onRefresh])

  // Proactively fetch AI Vehicle Recommendation on mount so it's visible during auto-dispatch on SHIPPED
  useEffect(() => {
    if (!orderId || isSelfDelivery) return
    let isMounted = true
    const loadAiVehicle = async () => {
      try {
        const query = new URLSearchParams()
        query.set("orderId", orderId)
        if (targetSeller) query.set("sellerId", targetSeller)
        const res = await fetch(`/api/admin/riders/available?${query.toString()}`)
        if (res.ok) {
          const data = await res.json()
          if (isMounted && data.aiVehicleRecommendation) {
            setAiVehicleRecommendation(data.aiVehicleRecommendation)
          }
        }
      } catch {
        // Non-blocking background fetch
      }
    }
    loadAiVehicle()
    return () => {
      isMounted = false
    }
  }, [orderId, targetSeller, isSelfDelivery])

  const fetchAvailableRiders = async () => {
    try {
      setLoadingRiders(true)
      const query = new URLSearchParams()
      if (orderId) query.set("orderId", orderId)
      if (targetSeller) query.set("sellerId", targetSeller)

      const res = await fetch(`/api/admin/riders/available?${query.toString()}`)
      const data = await res.json()
      if (res.ok) {
        setRiders(data.riders || [])
        setAiVehicleRecommendation(data.aiVehicleRecommendation || null)
      }
    } catch (err) {
      console.error("Failed to load riders list:", err)
    } finally {
      setLoadingRiders(false)
    }
  }

  const handleOpenModal = () => {
    if (isDelivered) return
    setModalOpen(true)
    fetchAvailableRiders()
  }

  const handleTriggerAutoDispatch = async () => {
    try {
      setDispatchLoading(true)
      const res = await fetch(`/api/admin/orders/${orderId}/assign-rider`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "auto_dispatch",
          sellerId: targetSeller,
          forceRedispatch: true,
          allowReofferRejected: true,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success !== false) {
        alert(data.message || "Auto-dispatch initiated! Nearest free rider is being contacted.")
        setModalOpen(false)
        onRefresh?.()
      } else {
        alert(data.message || data.error || "Failed to trigger auto-dispatch")
      }
    } catch (err: any) {
      alert(err?.message || "Network error")
    } finally {
      setDispatchLoading(false)
    }
  }

  const handleStopDispatch = async () => {
    const proceed = confirm("Are you sure you want to stop sending notifications and cancel the current offer?")
    if (!proceed) return

    try {
      setDispatchLoading(true)
      const res = await fetch(`/api/admin/orders/${orderId}/assign-rider`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "stop_dispatch",
          sellerId: targetSeller,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success !== false) {
        alert(data.message || "Notifications stopped and active offer cancelled.")
        setModalOpen(false)
        onRefresh?.()
      } else {
        alert(data.message || data.error || "Failed to stop dispatch")
      }
    } catch (err: any) {
      alert(err?.message || "Network error")
    } finally {
      setDispatchLoading(false)
    }
  }

  const handleCancelAssignment = async () => {
    const reason = prompt("Enter reason for cancelling this rider assignment:", "Rider did not show up")
    if (reason === null) return

    const autoReassign = confirm(
      "Do you want to automatically notify and dispatch the next available rider immediately?"
    )

    try {
      setDispatchLoading(true)
      const res = await fetch(`/api/admin/orders/${orderId}/assign-rider`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel_assignment",
          sellerId: targetSeller,
          reason: reason.trim() || "Rider did not show up",
          autoReassign,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success !== false) {
        alert(
          autoReassign
            ? (data.message || "Rider cancelled. Notification sent to the next available rider!")
            : (data.message || "Rider assignment cancelled. You can now reassign or auto-dispatch.")
        )
        setModalOpen(false)
        onRefresh?.()
      } else {
        alert(data.message || data.error || "Failed to cancel rider assignment")
      }
    } catch (err: any) {
      alert(err?.message || "Network error")
    } finally {
      setDispatchLoading(false)
    }
  }

  const handleManualAssign = async () => {
    if (!selectedRiderId) return
    const chosenRider = riders.find((r) => r.id === selectedRiderId)
    if (chosenRider && chosenRider.isVehicleMatch === false) {
      const proceed = confirm(
        `⚠️ Vehicle Mismatch Warning:\nThis package requires a ${aiVehicleRecommendation?.requiredVehicle?.replace(
          "_",
          " "
        )}. This rider may not have adequate vehicle capacity.\n\nDo you want to assign anyway?`
      )
      if (!proceed) return
    }

    try {
      setDispatchLoading(true)
      const res = await fetch(`/api/admin/orders/${orderId}/assign-rider`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riderId: selectedRiderId, sellerId: targetSeller }),
      })
      const data = await res.json()
      if (res.ok) {
        alert("Rider manually assigned successfully!")
        setModalOpen(false)
        onRefresh?.()
      } else {
        alert(data.error || "Failed to assign rider")
      }
    } catch (err: any) {
      alert(err?.message || "Network error")
    } finally {
      setDispatchLoading(false)
    }
  }

  const filteredRiders = riders.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchRider.toLowerCase()) ||
      (r.phone && r.phone.includes(searchRider)) ||
      (r.vehicleNumber && r.vehicleNumber.toLowerCase().includes(searchRider.toLowerCase()))

    if (!matchesSearch) return false
    if (vehicleFilterMode === "matched" && r.isVehicleMatch === false) return false
    return true
  })

  return (
    <div className="space-y-3 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 min-w-0">
        <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-foreground/70 min-w-0">
          <Bike className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span className="truncate">Delivery Rider Assignment</span>
        </h4>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {aiVehicleRecommendation && !isSelfDelivery && (
            <Badge className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 text-[9px] font-black uppercase tracking-wider py-0.5 px-2 rounded-full flex items-center gap-1 shrink-0">
              <Sparkles className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
              <span>Vehicle: {formatVehicleFriendly(aiVehicleRecommendation.requiredVehicle)}</span>
            </Badge>
          )}
          {activeAssignment && (
            isDelivered ? (
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Delivery Completed
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 shrink-0">
                <Radio className="w-2.5 h-2.5 animate-pulse shrink-0" /> Live Telemetry
              </span>
            )
          )}
        </div>
      </div>
      <div className="rounded-3xl bg-card p-4 sm:p-5 space-y-4 border border-border/80 shadow-sm relative overflow-hidden min-w-0">
        {activeAssignments.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 border-b border-border/40">
            {activeAssignments.map((a: any, i: number) => (
              <button
                key={a.id || i}
                type="button"
                onClick={() => setActivePackageIdx(i)}
                className={cn(
                  "text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all shrink-0",
                  activePackageIdx === i
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                )}
              >
                Package {i + 1} {a.seller?.store?.name ? `(${a.seller.store.name})` : ""}
              </button>
            ))}
          </div>
        )}

        {/* Active AI Vehicle Matching Summary Banner */}
        {aiVehicleRecommendation && !isSelfDelivery && !isDelivered && (
          <div className="p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/50 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 text-xs shadow-2xs min-w-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="p-1.5 rounded-xl bg-indigo-600 text-white shrink-0 shadow-xs">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <span className="text-[11px] font-black text-indigo-950 dark:text-indigo-100 truncate">
                    Vehicle Needed: {formatVehicleFriendly(aiVehicleRecommendation.requiredVehicle)}
                  </span>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
                    (~{aiVehicleRecommendation.estimatedWeightKg?.toFixed(1)} kg)
                  </span>
                </div>
                <p className="text-[10px] text-indigo-700/90 dark:text-indigo-300/90 truncate" title={aiVehicleRecommendation.reason}>
                  {aiVehicleRecommendation.reason}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/90 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 shrink-0 self-start sm:self-center">
              Smart Match
            </Badge>
          </div>
        )}

        {isSelfDelivery ? (
          <div className="text-center py-5 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-500/20 shadow-inner">
              {isDelivered ? <CheckCircle2 className="w-6 h-6" /> : <Truck className="w-6 h-6" />}
            </div>
            <div className="space-y-1 max-w-xs mx-auto">
              <p className="text-xs font-black text-foreground uppercase tracking-tight">
                {isDelivered ? "Delivered In-House (Self-Delivery)" : "Self-Delivery In-House Active"}
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {isDelivered
                  ? "This order was fulfilled and delivered directly by you / your store staff."
                  : "Platform riders are not dispatched for this order. You or your store staff are fulfilling delivery directly."}
              </p>
            </div>
            <div className="pt-1">
              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold py-1 px-3 rounded-full">
                {isDelivered ? "Delivery Completed by Store" : "Delivery Fee Retained by Seller"}
              </Badge>
            </div>
          </div>
        ) : !activeAssignment ? (
          <div className="text-center py-4 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center mx-auto">
              {isDelivered ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <Bike className="w-5 h-5" />}
            </div>
            <div className="space-y-1">
              {isRecentTimeout || isCascadeInProgress ? (
                <>
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center justify-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    Waterfall Dispatch in Progress...
                  </p>
                  <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                    {currentCycleHistorical.length > 0
                      ? `Wave attempt ${Math.min(currentCycleHistorical.length + 1, totalExpectedAttempts)} of ${totalExpectedAttempts} in progress. Contacting next available delivery rider in pool (${poolCount} ${poolCount === 1 ? "rider" : "riders"} available)...`
                      : "Searching and notifying nearest available delivery rider..."}
                  </p>
                </>
              ) : maxAttemptsReached ? (
                <>
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center justify-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    All {totalExpectedAttempts} Dispatch Attempts Completed (No Rider Accepted)
                  </p>
                  <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                    All {poolCount} nearest available {poolCount === 1 ? "rider received 5 offers" : `riders received 5 offers across 5 cascade flows (${totalExpectedAttempts} total attempts)`} and timed out or declined. Automated cascade is paused. You can restart auto-dispatch or assign a specific rider.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs font-bold text-foreground">
                    {isDelivered ? "Order Delivered" : "No Rider Assigned Yet"}
                  </p>
                  <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                    {isDelivered
                      ? "This order has been completed and marked as delivered."
                      : "Orders ready for pickup can be dispatched automatically or manually assigned."}
                  </p>
                </>
              )}
            </div>

            {canManage && !isDelivered && (
              <Button
                size="sm"
                onClick={handleOpenModal}
                className="rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Assign Delivery Rider
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Rider Identity Header */}
            <div className="flex items-start justify-between gap-3 min-w-0">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Avatar className="h-11 w-11 sm:h-12 sm:w-12 border-2 border-primary/20 shrink-0 shadow-xs">
                  <AvatarImage src={rider?.profileImage || riderUser?.image || ""} />
                  <AvatarFallback className="bg-blue-600 text-white font-bold text-sm">
                    {riderUser?.name?.[0] || "R"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm text-foreground truncate flex items-center gap-1.5">
                    <span className="truncate">{riderUser?.name || "Delivery Rider"}</span>
                    {isDelivered ? (
                      <Badge className="bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0 shrink-0">Delivered</Badge>
                    ) : isRiderOnline ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shrink-0" title="Online" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-400 inline-block shrink-0" title="Offline" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                    <Bike className="w-3 h-3 text-blue-600 shrink-0" />
                    <span className="truncate">{rider?.vehicleName || (Array.isArray(rider?.vehicleTypes) ? rider.vehicleTypes[0] : null) || "Standard Delivery"}</span>
                  </div>
                </div>
              </div>

              <Badge
                className={cn(
                  "text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide shrink-0",
                  isOffered
                    ? secondsLeft === 0
                      ? "bg-amber-600 text-white shadow-amber-600/20"
                      : "bg-amber-500 text-white shadow-amber-500/20"
                    : isDelivered
                    ? "bg-emerald-600 text-white shadow-emerald-600/20"
                    : "bg-blue-600 text-white shadow-blue-600/20"
                )}
              >
                {isOffered
                  ? secondsLeft === 0
                    ? `ATTEMPT #${activeAssignment.attemptNumber || 1} EXPIRED`
                    : `OFFERED (${secondsLeft !== null ? `${secondsLeft}s` : "60s"})`
                  : isDelivered
                  ? "DELIVERED"
                  : activeAssignment.status.replace(/_/g, " ")}
              </Badge>
            </div>

            {/* Live Waterfall Flow Banner */}
            {isOffered && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
                  <span className="font-bold text-amber-900 dark:text-amber-200">
                    ⚡ {activeAssignment.adminNotes || `Waterfall Cascade: Attempt #${activeAssignment.attemptNumber || 1}`}
                  </span>
                </div>
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  Offer sent to {riderUser?.name || "Rider"}. If not accepted within {secondsLeft ?? 60}s, the system automatically notifies the next available rider in the flow.
                </p>
              </div>
            )}

            {/* Clear "Delivered by" banner when delivered */}
            {isDelivered && (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold text-xs text-emerald-800 dark:text-emerald-300">
                    Delivered by {riderUser?.name || "Delivery Partner"}
                  </span>
                </div>
                {activeAssignment.updatedAt && (
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {new Date(activeAssignment.updatedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            )}

            {/* Comprehensive Rider & Vehicle Specs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3 border-t border-border/60 text-xs">
              <div className="p-2 rounded-xl bg-muted/40 border border-border/40">
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                  Vehicle Plate
                </span>
                <span className="font-semibold text-foreground truncate block">
                  {rider?.vehicleNumber || "Not Provided"}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-muted/40 border border-border/40">
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                  Driver's License
                </span>
                <span className="font-semibold text-foreground truncate block">
                  {rider?.drivingLicenseNo || "Verified on File"}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-muted/40 border border-border/40">
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                  Delivery Status
                </span>
                <span className={cn("font-semibold block", isDelivered ? "text-emerald-600" : "text-blue-600")}>
                  {isDelivered ? "Delivered" : activeAssignment.distanceKm ? `${activeAssignment.distanceKm} km away` : "Nearby"}
                </span>
              </div>
            </div>

            {/* Handover OTP: Hidden from seller & admin before delivery; only customer can see active OTP */}
            {isDelivered && activeAssignment.deliveryOtp ? (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider block text-emerald-700 dark:text-emerald-400">
                    Verified Handover OTP
                  </span>
                  <span className="text-base font-mono font-extrabold tracking-widest text-emerald-800 dark:text-emerald-200">
                    {activeAssignment.deliveryOtp}
                  </span>
                </div>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium text-right">
                  Verified with Customer at Doorstep
                </span>
              </div>
            ) : !isDelivered && (
              <div className="p-3 rounded-2xl bg-muted/40 border border-border/40 text-xs flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 min-w-0">
                <div className="space-y-0.5 min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider block text-muted-foreground truncate">
                    Customer Handover Verification
                  </span>
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 truncate">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                    <span className="truncate">Secure OTP with Customer</span>
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground text-left sm:text-right max-w-full sm:max-w-[200px] leading-tight shrink-0">
                  Only the customer can see the OTP to share with the rider upon arrival.
                </span>
              </div>
            )}

            {/* Package Pickup Proof (Uploaded by Rider upon collection) */}
            {pickupPhotosList.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/40 text-xs space-y-2.5 min-w-0">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Camera className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="font-bold text-[11px] uppercase tracking-wider text-indigo-950 dark:text-indigo-200 truncate">
                      Package Pickup Proof ({pickupPhotosList.length} {pickupPhotosList.length === 1 ? "Photo" : "Photos"})
                    </span>
                  </div>
                  <Badge className="bg-indigo-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full shrink-0">
                    Verified at Store
                  </Badge>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                  {pickupPhotosList.map((url: string, idx: number) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPreviewPhotoUrl(url)}
                      className="group relative aspect-square rounded-xl overflow-hidden border border-indigo-200/80 dark:border-indigo-800/60 hover:ring-2 hover:ring-indigo-500 transition-all bg-background/50 shadow-2xs text-left"
                    >
                      <img
                        src={url}
                        alt={`Package pickup proof ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <Maximize2 className="w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  Photos captured by the rider when collecting the package from the seller. Tap any photo to inspect full size.
                </p>
              </div>
            )}

            {/* Contact & Reassign Actions - NO Reassign or Cancel when Delivered */}
            <div className="pt-2 flex flex-wrap items-center gap-2">
              {riderUser?.phone && (
                <a
                  href={`tel:${riderUser.phoneCountryCode || "+232"}${riderUser.phone}`}
                  className="flex-1 min-w-[130px]"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs rounded-xl gap-1.5 font-semibold text-blue-600 border-blue-200 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                  >
                    <Phone className="w-3.5 h-3.5" /> Call ({riderUser.phoneCountryCode || "+232"} {riderUser.phone})
                  </Button>
                </a>
              )}
              {riderUser?.email && (
                <a
                  href={`mailto:${riderUser.email}`}
                  className="inline-flex items-center justify-center h-8 px-3 rounded-xl border text-xs font-semibold text-muted-foreground hover:text-foreground bg-background hover:bg-muted"
                  title={riderUser.email}
                >
                  Email Rider
                </a>
              )}
              {canManage && isOffered && !isDelivered && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStopDispatch}
                  disabled={dispatchLoading}
                  className="text-xs rounded-xl text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900/50 dark:hover:bg-rose-950/30 gap-1.5 font-medium"
                >
                  <BellOff className="w-3.5 h-3.5" />
                  Stop Notification
                </Button>
              )}
              {canManage && canCancelRider && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelAssignment}
                  disabled={dispatchLoading}
                  className="text-xs rounded-xl text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900/50 dark:hover:bg-rose-950/30 gap-1.5 font-medium"
                >
                  <UserX className="w-3.5 h-3.5" />
                  Cancel Rider
                </Button>
              )}
              {canManage && !isDelivered && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenModal}
                  className="text-xs rounded-xl text-muted-foreground hover:text-foreground gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reassign
                </Button>
              )}
            </div>

            {/* Live GPS Tracking Map */}
            {showLiveMap && !isOffered && (
              <div className="pt-2 border-t border-border/50">
                <OrderLiveTrackingMap
                  orderId={orderId}
                  orderNumber={orderNumber}
                  orderStatus={orderStatus || activeAssignment.status}
                  deliveryAssignments={deliveryAssignments}
                  shippingAddress={shippingAddress}
                  destinationLat={destinationLat}
                  destinationLng={destinationLng}
                  height="280px"
                />
              </div>
            )}
          </div>
        )}

        {/* Dispatch Attempt History (collapsible) */}
        {historicalAttempts.length > 0 && (
          <div className="pt-3 border-t border-border/40">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="text-[11px] font-semibold text-muted-foreground hover:text-foreground flex items-center justify-between w-full py-1"
            >
              <span className="flex items-center gap-1.5">
                📜 Waterfall History ({historicalAttempts.length}{" "}
                {historicalAttempts.length === 1 ? "attempt" : "attempts"} logged)
              </span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                {showHistory ? "Hide" : "View"}
              </span>
            </button>

            {showHistory && (
              <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {historicalAttempts.map((attempt: any, idx: number) => {
                  const rName =
                    attempt.rider?.user?.name ||
                    `Rider #${attempt.riderId?.slice(-4) || idx + 1}`
                  const statusLabel =
                    attempt.status === "TIMED_OUT"
                      ? "Timed Out (60s expired)"
                      : attempt.status === "REJECTED"
                      ? "Declined by Rider"
                      : attempt.status === "CANCELLED_BY_RIDER"
                      ? "Cancelled by Rider"
                      : attempt.status === "REASSIGNED_BY_ADMIN"
                      ? "Reassigned"
                      : attempt.status
                  return (
                    <div
                      key={attempt.id || idx}
                      className="flex items-center justify-between p-2 rounded-xl bg-muted/40 text-[11px] border border-border/30"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-bold text-foreground">
                          #{attempt.attemptNumber || idx + 1}
                        </span>
                        <span className="truncate text-muted-foreground">{rName}</span>
                        {attempt.adminNotes && (
                          <span className="text-[10px] text-muted-foreground/70 truncate hidden sm:inline">
                            • {attempt.adminNotes.split("(")[0].trim()}
                          </span>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0 font-medium">
                        {statusLabel}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Assign / Reassign Modal (Disabled if order is delivered) */}
      {!isDelivered && (
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Bike className="w-5 h-5 text-blue-600" />
              Dispatch / Reassign Delivery Rider
            </DialogTitle>
            <DialogDescription className="text-xs">
              Choose to automatically dispatch via proximity waterfall or manually select an active rider.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* AI Vehicle Recommendation Banner */}
            {aiVehicleRecommendation && (
              <div className="p-3.5 rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold flex items-center gap-1.5 text-indigo-900 dark:text-indigo-200">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    AI Vehicle Requirement:
                  </span>
                  <Badge className="bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider">
                    {aiVehicleRecommendation.requiredVehicle.replace("_", " ")}
                  </Badge>
                </div>
                <p className="text-[11px] text-indigo-700 dark:text-indigo-300 leading-relaxed">
                  {aiVehicleRecommendation.reason}
                </p>
                <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                  Est. Weight: ~{aiVehicleRecommendation.estimatedWeightKg?.toFixed(1)} kg
                </div>

                {/* Radio Button Filter Controls */}
                <div className="pt-2 border-t border-indigo-200/70 dark:border-indigo-800/70 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-200 block">
                    Vehicle Filter Mode:
                  </span>

                  <RadioGroup
                    value={vehicleFilterMode}
                    onValueChange={(val) => setVehicleFilterMode(val as "matched" | "all")}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                  >
                    <label
                      htmlFor="radio-filter-matched"
                      className={cn(
                        "flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-all text-xs",
                        vehicleFilterMode === "matched"
                          ? "bg-indigo-100 dark:bg-indigo-900/60 border-indigo-500 shadow-xs font-semibold text-indigo-950 dark:text-indigo-100 ring-1 ring-indigo-400"
                          : "bg-white/80 dark:bg-indigo-950/20 border-indigo-200/80 text-muted-foreground hover:bg-indigo-50/50"
                      )}
                    >
                      <RadioGroupItem value="matched" id="radio-filter-matched" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] leading-tight font-bold">Compatible Only</span>
                          <span className="text-[8px] px-1 py-0.2 rounded bg-indigo-600 text-white font-bold uppercase">
                            Rec
                          </span>
                        </div>
                        <span className="text-[9px] block text-indigo-600 dark:text-indigo-400 opacity-90 truncate">
                          {aiVehicleRecommendation.requiredVehicle.replace("_", " ")} only
                        </span>
                      </div>
                    </label>

                    <label
                      htmlFor="radio-filter-all"
                      className={cn(
                        "flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-all text-xs",
                        vehicleFilterMode === "all"
                          ? "bg-indigo-100 dark:bg-indigo-900/60 border-indigo-500 shadow-xs font-semibold text-indigo-950 dark:text-indigo-100 ring-1 ring-indigo-400"
                          : "bg-white/80 dark:bg-indigo-950/20 border-indigo-200/80 text-muted-foreground hover:bg-indigo-50/50"
                      )}
                    >
                      <RadioGroupItem value="all" id="radio-filter-all" />
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] leading-tight font-bold block">Show All Vehicles</span>
                        <span className="text-[9px] block text-muted-foreground opacity-90 truncate">
                          All riders (2W, 3W, 4W)
                        </span>
                      </div>
                    </label>
                  </RadioGroup>

                  {/* Important Explanatory Note */}
                  <div className="p-2 rounded-xl bg-white/80 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800/60 text-[10px] leading-relaxed flex items-start gap-1.5 shadow-2xs">
                    {vehicleFilterMode === "matched" ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="text-indigo-900 dark:text-indigo-200">
                          <strong>Active Filter:</strong> Showing only riders equipped for {aiVehicleRecommendation.requiredVehicle.replace("_", " ")} cargo (~{aiVehicleRecommendation.estimatedWeightKg?.toFixed(1)}kg) for safe transit.
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span className="text-amber-900 dark:text-amber-200">
                          <strong>Important Note:</strong> Displaying all riders. Assigning heavy or oversized cargo to a 2-Wheeler (motorbike) may lead to rider refusal or delivery cancellation.
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Auto Dispatch Card */}
            <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 space-y-3">
              {/* Active Pending Offer Banner in Modal */}
              {isOffered && activeAssignment && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                      Currently Notified Partner (Attempt #{activeAssignment.attemptNumber || 1})
                    </span>
                    <Badge className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5">
                      {secondsLeft === 0 ? "EXPIRED" : "OFFERED"}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="h-9 w-9 border shrink-0">
                        <AvatarImage src={rider?.profileImage || riderUser?.image || ""} />
                        <AvatarFallback className="bg-amber-500 text-white font-bold text-xs">
                          {riderUser?.name?.[0] || "R"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-foreground truncate flex items-center gap-1.5">
                          {riderUser?.name || "Delivery Partner"}
                          {isRiderOnline ? (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shrink-0" title="Online" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-slate-400 inline-block shrink-0" title="Offline" />
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                          <Bike className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>{rider?.vehicleName || "Vehicle"} • {activeAssignment.distanceKm ? `${activeAssignment.distanceKm} km away` : "Nearby"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-black text-amber-700 dark:text-amber-300">
                        {secondsLeft === 0 ? "0s (Expired)" : secondsLeft !== null ? `${secondsLeft}s left` : "Pending"}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {secondsLeft === 0 ? "Ready to re-dispatch" : "Awaiting accept"}
                      </span>
                    </div>
                  </div>

                  {/* Device Notification Connectivity Status */}
                  <div className="pt-1.5 border-t border-amber-500/20 flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">Notification Status:</span>
                    {Array.isArray(rider?.deviceTokens) && rider.deviceTokens.length > 0 ? (
                      <span className="font-semibold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {rider.deviceTokens.length} device(s) registered
                      </span>
                    ) : (
                      <span className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        No device registered (Notification not received)
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-blue-900 dark:text-blue-200">
                    Option A: Automated Waterfall Dispatch
                  </h4>
                  <p className="text-[11px] text-blue-700 dark:text-blue-400">
                    Contacts closest free rider matching required vehicle category ({aiVehicleRecommendation?.requiredVehicle?.replace("_", " ") || "Compatible"}).
                  </p>
                </div>
              </div>
              <Button
                onClick={handleTriggerAutoDispatch}
                disabled={dispatchLoading}
                className="w-full text-xs rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", dispatchLoading && "animate-spin")} />
                {dispatchLoading
                  ? "Dispatching..."
                  : isOffered
                  ? "Cancel Current Offer & Auto-Dispatch Next Rider"
                  : activeAssignment
                  ? "Revoke Current Rider & Auto-Dispatch Next Rider"
                  : "Start Auto-Dispatch Engine"}
              </Button>
              {isOffered && (
                <Button
                  variant="outline"
                  onClick={handleStopDispatch}
                  disabled={dispatchLoading}
                  className="w-full text-xs rounded-xl font-bold text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900/50 dark:hover:bg-rose-950/30 gap-1.5"
                >
                  <BellOff className="w-3.5 h-3.5 text-rose-600" />
                  Stop Sending Notifications (Cancel Offer)
                </Button>
              )}
            </div>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-border w-full" />
              <span className="bg-background px-3 text-[11px] text-muted-foreground uppercase font-bold shrink-0">
                Or Select Rider Manually
              </span>
            </div>

            {/* Manual Selection List */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by rider name, phone, vehicle..."
                  value={searchRider}
                  onChange={(e) => setSearchRider(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 text-xs rounded-xl border border-input bg-background"
                />
              </div>

              <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 divide-y divide-border/40">
                {loadingRiders ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Loading riders...
                  </div>
                ) : filteredRiders.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground space-y-1">
                    <p className="font-semibold">
                      {vehicleFilterMode === "matched"
                        ? "No approved riders with compatible vehicle found."
                        : "No approved riders found."}
                    </p>
                    {vehicleFilterMode === "matched" && riders.length > 0 && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        ({riders.length} rider(s) available in other vehicle categories. Select &quot;Show All Vehicles&quot; above to view them.)
                      </p>
                    )}
                  </div>
                ) : (
                  filteredRiders.map((r) => {
                    const isSelected = selectedRiderId === r.id
                    return (
                      <div
                        key={r.id}
                        onClick={() => setSelectedRiderId(r.id)}
                        className={cn(
                          "p-2.5 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-all",
                          isSelected
                            ? "bg-blue-100 dark:bg-blue-950/60 border border-blue-400"
                            : "hover:bg-muted/60"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar className="h-7 w-7 border shrink-0">
                            <AvatarImage src={r.image || ""} />
                            <AvatarFallback className="text-[10px] bg-blue-600 text-white">
                              {r.name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-bold text-foreground truncate flex items-center gap-1.5">
                              {r.name}
                              {r.vehicleName && (
                                <span className="text-[10px] font-normal text-blue-600 dark:text-blue-400">
                                  ({r.vehicleName})
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {r.phoneCountryCode || "+232"} {r.phone || "No phone"} {r.vehicleNumber ? `• ${r.vehicleNumber}` : ""}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {r.vehicleTypes?.length > 0 && (
                            <div className="flex gap-1">
                              {r.vehicleTypes.map((vt: string) => (
                                <Badge
                                  key={vt}
                                  variant="secondary"
                                  className="text-[9px] px-1.5 py-0 font-medium"
                                >
                                  {vt === "2_WHEELER"
                                    ? "2W"
                                    : vt === "3_WHEELER"
                                    ? "3W"
                                    : "4W"}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {r.isVehicleMatch ? (
                            <Badge className="text-[9px] bg-emerald-600 text-white">
                              AI Match
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[9px] text-amber-600 border-amber-300"
                            >
                              Size Mismatch
                            </Badge>
                          )}
                          {r.isBusy ? (
                            <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-300">
                              Busy
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] text-emerald-600 border-emerald-300">
                              Available
                            </Badge>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleManualAssign}
              disabled={dispatchLoading || !selectedRiderId}
              className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {dispatchLoading ? "Assigning..." : "Confirm Manual Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}

      {/* Package Pickup Photo Preview Lightbox Dialog */}
      <Dialog open={!!previewPhotoUrl} onOpenChange={(open) => !open && setPreviewPhotoUrl(null)}>
        <DialogContent className="max-w-2xl p-3 bg-black/95 border border-slate-800 text-white rounded-3xl overflow-hidden">
          <div className="relative flex flex-col items-center justify-center p-1">
            {previewPhotoUrl && (
              <img
                src={previewPhotoUrl}
                alt="Package pickup full preview"
                className="max-h-[75vh] w-auto object-contain rounded-2xl"
              />
            )}
            <div className="w-full flex items-center justify-between pt-3 px-2 text-xs text-slate-300">
              <span className="font-semibold flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-indigo-400" /> Package Pickup Proof
              </span>
              <a
                href={previewPhotoUrl || "#"}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 underline"
              >
                Open original in new tab <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
