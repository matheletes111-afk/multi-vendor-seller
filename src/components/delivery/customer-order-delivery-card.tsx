"use client"

import React, { useState, useEffect } from "react"
import {
  Bike,
  Car,
  Truck,
  Phone,
  ShieldCheck,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Store,
  Navigation,
  RefreshCw,
  Sparkles,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/ui/avatar"
import { OrderLiveTrackingMap } from "./order-live-tracking-map"
import type { OrderDetailApi } from "@/app/api/customer/orders/types"
import { cn } from "@/lib/utils"

interface CustomerOrderDeliveryCardProps {
  order: OrderDetailApi
  onRefresh?: () => void
  className?: string
  mapHeight?: string
}

export function CustomerOrderDeliveryCard({
  order,
  onRefresh,
  className = "",
  mapHeight = "300px",
}: CustomerOrderDeliveryCardProps) {
  const [refreshing, setRefreshing] = useState(false)

  const handleManualRefresh = async () => {
    if (!onRefresh || refreshing) return
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setTimeout(() => setRefreshing(false), 800)
    }
  }

  // 1. Resolve active assignment(s)
  const assignments = order.deliveryAssignments || []
  const activeAssignments = assignments.filter((a: any) =>
    ["OFFERED", "ACCEPTED", "AT_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED"].includes(a.status)
  )

  // Primary active assignment (favor OUT_FOR_DELIVERY > PICKED_UP > AT_PICKUP > ACCEPTED > OFFERED > DELIVERED)
  const primaryAssignment =
    activeAssignments.find((a: any) => a.status === "OUT_FOR_DELIVERY") ||
    activeAssignments.find((a: any) => a.status === "PICKED_UP") ||
    activeAssignments.find((a: any) => a.status === "AT_PICKUP") ||
    activeAssignments.find((a: any) => a.status === "ACCEPTED") ||
    activeAssignments.find((a: any) => a.status === "OFFERED") ||
    activeAssignments.find((a: any) => a.status === "DELIVERED") ||
    activeAssignments[0] ||
    order.activeDeliveryTracking ||
    null

  // Check if all items are self-delivery
  const isSelfDeliveryOrder =
    Boolean((order as any).isSelfDelivery) ||
    (order.items && order.items.length > 0 && order.items.every((i: any) => Boolean(i.isSelfDelivery)))

  // In-house relevant items
  const relevantItems = (order.items || []).filter(
    (i: any) =>
      i.isSelfDelivery ||
      i.deliveryOtp ||
      ["PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(i.itemStatus)
  )

  // Periodic polling for active deliveries to keep location and status real-time
  useEffect(() => {
    if (!primaryAssignment || !onRefresh) return
    const isLive = ["OFFERED", "ACCEPTED", "AT_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY"].includes(
      primaryAssignment.status
    )
    if (!isLive) return

    const timer = setInterval(() => {
      onRefresh()
    }, 12000)

    return () => clearInterval(timer)
  }, [primaryAssignment?.status, onRefresh])

  // ── CASE 1: In-House Store Delivery ──────────────────────────────────────────
  if (isSelfDeliveryOrder && !primaryAssignment) {
    const activeOtp = relevantItems.find((i: any) => i.deliveryOtp && i.itemStatus !== "DELIVERED")?.deliveryOtp
    const isDelivered = (order.items || []).every((i: any) => i.itemStatus === "DELIVERED")

    return (
      <Card className={cn("border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm", className)}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100">
              <Store className="h-4 w-4 text-emerald-600" />
              Store Fulfillment (In-House Delivery)
            </CardTitle>
            <Badge className="bg-emerald-600 text-white text-[10px] capitalize">
              {isDelivered ? "Delivered by Store" : "Store In-House Delivery"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-xs text-gray-600 dark:text-gray-300">
            {isDelivered
              ? "This order was delivered directly by the store fulfillment team."
              : "This order is being delivered directly by the seller store in-house staff."}
          </p>
          {activeOtp && !isDelivered && (
            <div className="p-3 rounded-2xl bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800 text-center space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Customer Handover OTP
              </div>
              <div className="text-2xl font-mono font-black tracking-widest text-emerald-600">
                {activeOtp}
              </div>
              <p className="text-[11px] text-gray-500">
                Share this 6-digit code with the store delivery staff upon package arrival to confirm delivery.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // ── CASE 2: No assignment yet (Order confirmed / Pending) ─────────────────────
  if (!primaryAssignment) {
    if (order.status === "PENDING" || order.status === "CONFIRMED") {
      return (
        <Card className={cn("border-blue-100 bg-blue-50/30 dark:bg-blue-950/10 shadow-xs", className)}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0 text-blue-600">
              <Clock className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
                Order Confirmed — Store Preparing Package
              </p>
              <p className="text-[11px] text-gray-500">
                A nearby delivery rider will be assigned automatically as soon as the store begins processing.
              </p>
            </div>
          </CardContent>
        </Card>
      )
    }
    return null
  }

  // ── CASE 3: Active Platform Rider Delivery Assignment ─────────────────────────
  const rider = primaryAssignment.rider
  const riderUser = rider?.user
  const isOffered = primaryAssignment.status === "OFFERED"
  const isOutForDelivery = primaryAssignment.status === "OUT_FOR_DELIVERY"
  const isDelivered =
    primaryAssignment.status === "DELIVERED" ||
    order.status === "DELIVERED" ||
    (order.items && order.items.length > 0 && order.items.every((i: any) => i.itemStatus === "DELIVERED"))
  const isPickedUp = primaryAssignment.status === "PICKED_UP"
  const isAtPickup = primaryAssignment.status === "AT_PICKUP"
  const isAccepted = primaryAssignment.status === "ACCEPTED"

  // Handover OTP
  const deliveryOtp =
    primaryAssignment.deliveryOtp ||
    (order.items || []).find((i: any) => i.deliveryOtp && i.itemStatus !== "DELIVERED")?.deliveryOtp

  // Vehicle resolution
  const vehicleTypeRaw =
    (Array.isArray(rider?.vehicleTypes) ? rider.vehicleTypes[0] : null) ||
    rider?.vehicleType ||
    "2_WHEELER"
  const vehicleType = String(vehicleTypeRaw).toUpperCase()

  const renderVehicleIcon = () => {
    if (vehicleType.includes("3_WHEELER") || vehicleType.includes("KEKE") || vehicleType.includes("TRICYCLE")) {
      return <Car className="h-4 w-4 text-cyan-600" />
    }
    if (vehicleType.includes("4_WHEELER") || vehicleType.includes("CAR") || vehicleType.includes("VAN")) {
      return <Truck className="h-4 w-4 text-indigo-600" />
    }
    return <Bike className="h-4 w-4 text-blue-600" />
  }

  // Friendly status label
  const getStatusLabel = () => {
    if (isOffered) return "Finding Nearby Rider"
    if (isAtPickup) return "Rider At Store Pickup"
    if (isPickedUp) return "Order Picked Up"
    if (isOutForDelivery) return "⚡ Out For Delivery"
    if (isDelivered) return "Order Delivered"
    if (isAccepted) return "Delivery Partner Assigned"
    return String(primaryAssignment.status).replace(/_/g, " ")
  }

  const getStatusBadgeClass = () => {
    if (isDelivered) return "bg-emerald-600 text-white"
    if (isOutForDelivery) return "bg-blue-600 text-white animate-pulse"
    if (isPickedUp || isAtPickup) return "bg-indigo-600 text-white"
    if (isOffered) return "bg-amber-500 text-white"
    return "bg-slate-800 text-white"
  }

  return (
    <Card className={cn("border-blue-200 bg-gradient-to-b from-blue-50/40 to-white dark:from-blue-950/20 dark:to-gray-950 shadow-md overflow-hidden", className)}>
      <CardHeader className="pb-3 border-b border-blue-100 dark:border-blue-900/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600">
              {renderVehicleIcon()}
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                Delivery Partner Tracking
                {isOutForDelivery && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />
                    Live
                  </span>
                )}
              </CardTitle>
              <p className="text-[11px] text-gray-500">
                {isOffered
                  ? "Assigning the nearest available rider..."
                  : riderUser?.name
                  ? `${riderUser.name} is handling your delivery`
                  : "Verified Delivery Partner"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className={cn("text-[10px] font-bold px-2.5 py-0.5 rounded-full capitalize shadow-xs", getStatusBadgeClass())}>
              {getStatusLabel()}
            </Badge>

            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleManualRefresh}
                disabled={refreshing}
                aria-label="Refresh tracking"
                className="h-7 w-7 text-gray-500 hover:text-blue-600 hover:bg-blue-100/50 rounded-lg"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin text-blue-600")} />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* ── Sub-card A: Rider Identity & Call Action ──────────────────────── */}
        {isOffered ? (
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex items-start gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping mt-1 shrink-0" />
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                Dispatching nearby delivery rider
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                We are alerting nearby available delivery riders. Real-time GPS location will appear here immediately once a rider confirms.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-11 w-11 border-2 border-blue-500/30 shadow-xs">
                <AvatarImage src={riderUser?.image || rider?.profileImage || ""} />
                <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white text-sm font-black">
                  {riderUser?.name?.[0]?.toUpperCase() || "R"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">
                  {riderUser?.name || "Delivery Partner"}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span>{rider?.vehicleNumber ? `Plate: ${rider.vehicleNumber}` : "Verified Vehicle"}</span>
                  {primaryAssignment.distanceKm != null && primaryAssignment.distanceKm > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-blue-600 font-semibold">{primaryAssignment.distanceKm} km away</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {riderUser?.phone && (
              <a href={`tel:${riderUser.phone}`} className="shrink-0">
                <Button
                  size="sm"
                  className="h-9 px-3.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-sm transition-transform active:scale-95"
                >
                  <Phone className="h-3.5 w-3.5" /> Call Rider
                </Button>
              </a>
            )}
          </div>
        )}

        {/* ── Sub-card B: Customer Handover OTP ────────────────────────────── */}
        {deliveryOtp && !isDelivered && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-md text-center space-y-1.5">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-100">
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              Customer Handover OTP
            </div>
            <div className="text-3xl font-mono font-black tracking-widest text-white drop-shadow-sm">
              {deliveryOtp}
            </div>
            <p className="text-[11px] text-blue-100/90 max-w-sm mx-auto">
              Please share this 6-digit verification code with the delivery rider when they hand over your package.
            </p>
          </div>
        )}

        {/* ── Sub-card C: Interactive Live GPS Map ─────────────────────────── */}
        {!isOffered && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-gray-500 px-1">
              <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                {isDelivered ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Navigation className="w-3.5 h-3.5 text-blue-600" />
                )}
                {isDelivered ? "Delivery Destination Location" : "Live GPS Route & Telemetry"}
              </span>
              <span className="text-[11px] text-gray-400">
                {isDelivered ? "Delivered" : "Updated in real-time"}
              </span>
            </div>

            <OrderLiveTrackingMap
              orderId={order.id}
              orderNumber={order.orderNumber}
              orderStatus={order.status}
              deliveryAssignments={[primaryAssignment]}
              shippingAddress={{
                fullName: order.shippingFullName,
                phone: order.shippingPhone,
                addressLine1: order.shippingAddressLine1,
                addressLine2: order.shippingAddressLine2,
                city: order.shippingCity,
                state: order.shippingState,
                postalCode: order.shippingPostalCode,
                country: order.shippingCountry,
              }}
              height={mapHeight}
              className="rounded-2xl"
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
