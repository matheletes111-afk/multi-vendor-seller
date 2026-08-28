"use client"

import React, { useState, useEffect } from "react"
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
  onRefresh?: () => void
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
  onRefresh,
}: OrderRiderCardProps) {
  const [dispatchLoading, setDispatchLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [riders, setRiders] = useState<any[]>([])
  const [loadingRiders, setLoadingRiders] = useState(false)
  const [searchRider, setSearchRider] = useState("")
  const [selectedRiderId, setSelectedRiderId] = useState<string>("")
  const [activePackageIdx, setActivePackageIdx] = useState(0)

  // Find the active assignments (filter by sellerId if specified)
  const activeAssignments = deliveryAssignments.filter(
    (a) =>
      ["OFFERED", "ACCEPTED", "AT_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED"].includes(
        a.status
      ) && (!sellerId || a.sellerId === sellerId)
  )

  const [aiVehicleRecommendation, setAiVehicleRecommendation] = useState<any>(null)
  const [onlyMatchedVehicles, setOnlyMatchedVehicles] = useState(false)

  const activeAssignment = activeAssignments[activePackageIdx] || activeAssignments[0] || null

  const rider = activeAssignment?.rider
  const riderUser = rider?.user
  const isOffered = activeAssignment?.status === "OFFERED"
  const isDelivered = activeAssignment?.status === "DELIVERED"

  const targetSeller = activeAssignment?.sellerId || sellerId || undefined

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
    setModalOpen(true)
    fetchAvailableRiders()
  }

  const handleTriggerAutoDispatch = async () => {
    try {
      setDispatchLoading(true)
      const res = await fetch(`/api/admin/orders/${orderId}/assign-rider`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auto_dispatch", sellerId: targetSeller }),
      })
      const data = await res.json()
      if (res.ok) {
        alert("Auto-dispatch initiated! Nearest free rider is being contacted.")
        setModalOpen(false)
        onRefresh?.()
      } else {
        alert(data.error || "Failed to trigger dispatch")
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
    if (onlyMatchedVehicles && r.isVehicleMatch === false) return false
    return true
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-foreground/70">
          <Bike className="w-3.5 h-3.5 text-blue-600" />
          Delivery Rider Assignment
        </h4>
        {activeAssignment && (
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
            <Radio className="w-2.5 h-2.5 animate-pulse" /> Live Telemetry
          </span>
        )}
      </div>
      <div className="rounded-3xl bg-card p-5 space-y-4 border border-border/80 shadow-sm relative overflow-hidden">
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

        {!activeAssignment ? (
          <div className="text-center py-4 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center mx-auto">
              <Bike className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-foreground">No Rider Assigned Yet</p>
              <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                Orders ready for pickup can be dispatched automatically or manually assigned.
              </p>
            </div>

            {canManage && (
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
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 border-2 border-primary/20 shrink-0 shadow-xs">
                  <AvatarImage src={rider?.profileImage || riderUser?.image || ""} />
                  <AvatarFallback className="bg-blue-600 text-white font-bold text-sm">
                    {riderUser?.name?.[0] || "R"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="font-bold text-sm text-foreground truncate flex items-center gap-1.5">
                    {riderUser?.name || "Delivery Rider"}
                    {rider?.isOnline ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shrink-0" title="Online" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-400 inline-block shrink-0" title="Offline" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                    <Bike className="w-3 h-3 text-blue-600 shrink-0" />
                    <span>{rider?.vehicleName || (Array.isArray(rider?.vehicleTypes) ? rider.vehicleTypes[0] : null) || "Standard Delivery"}</span>
                  </div>
                </div>
              </div>

              <Badge
                className={cn(
                  "text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide",
                  isOffered
                    ? "bg-amber-500 text-white shadow-amber-500/20"
                    : isDelivered
                    ? "bg-emerald-600 text-white shadow-emerald-600/20"
                    : "bg-blue-600 text-white shadow-blue-600/20"
                )}
              >
                {activeAssignment.status.replace(/_/g, " ")}
              </Badge>
            </div>

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
                  Proximity
                </span>
                <span className="font-semibold text-blue-600 block">
                  {activeAssignment.distanceKm ? `${activeAssignment.distanceKm} km away` : "Nearby"}
                </span>
              </div>
            </div>

            {/* Handover OTP if applicable */}
            {activeAssignment.deliveryOtp && !isDelivered && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider block text-amber-700 dark:text-amber-400">
                    Delivery Handover OTP
                  </span>
                  <span className="text-base font-mono font-extrabold tracking-widest text-amber-800 dark:text-amber-200">
                    {activeAssignment.deliveryOtp}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground text-right">
                  Give code to customer at doorstep
                </span>
              </div>
            )}

            {/* Contact & Reassign Actions */}
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
      </div>

      {/* Assign / Reassign Modal */}
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
              <div className="p-3 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-1.5">
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
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400">
                    Est. Weight: ~{aiVehicleRecommendation.estimatedWeightKg?.toFixed(1)} kg
                  </span>
                  <button
                    type="button"
                    onClick={() => setOnlyMatchedVehicles(!onlyMatchedVehicles)}
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-all",
                      onlyMatchedVehicles
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-200"
                    )}
                  >
                    {onlyMatchedVehicles ? "Showing Matched Only" : "Filter Compatible Vehicles"}
                  </button>
                </div>
              </div>
            )}

            {/* Auto Dispatch Card */}
            <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 space-y-2">
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
                {dispatchLoading ? "Dispatching..." : "Start Auto-Dispatch Engine"}
              </Button>
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
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    {onlyMatchedVehicles
                      ? "No approved riders with compatible vehicle found."
                      : "No approved riders found."}
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
    </div>
  )
}
