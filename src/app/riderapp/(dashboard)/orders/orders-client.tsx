"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import {
  Package,
  MapPin,
  CheckCircle2,
  Clock,
  Bike,
  ArrowRight,
  Phone,
  Store,
  Navigation,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
} from "lucide-react"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { cn } from "@/lib/utils"

export function RiderOrdersClient() {
  const [tab, setTab] = useState<"active" | "offered" | "completed" | "all">("active")
  const [assignments, setAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = async (currentTab = tab) => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/riderapp/orders?tab=${currentTab}`)
      const data = await res.json()
      if (res.ok) {
        setAssignments(data.assignments || [])
      } else {
        setError(data.error || "Failed to load orders")
      }
    } catch (err: any) {
      setError(err?.message || "Network error loading orders")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders(tab)
    // Auto refresh every 15s to check for new assignments
    const interval = setInterval(() => {
      fetchOrders(tab)
    }, 15000)
    return () => clearInterval(interval)
  }, [tab])

  const handleAccept = async (assignmentId: string) => {
    try {
      setActionLoading(assignmentId)
      const res = await fetch(`/api/riderapp/orders/${assignmentId}/accept`, {
        method: "POST",
      })
      const data = await res.json()
      if (res.ok) {
        setTab("active")
        fetchOrders("active")
      } else {
        alert(data.error || "Failed to accept assignment")
      }
    } catch (err: any) {
      alert(err?.message || "Network error")
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (assignmentId: string) => {
    if (!confirm("Are you sure you want to decline this delivery offer?")) return
    try {
      setActionLoading(assignmentId)
      const res = await fetch(`/api/riderapp/orders/${assignmentId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Declined by rider" }),
      })
      if (res.ok) {
        fetchOrders(tab)
      } else {
        const data = await res.json()
        alert(data.error || "Failed to decline")
      }
    } catch (err: any) {
      alert(err?.message || "Network error")
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Package className="w-6 h-6 text-blue-600" />
            Delivery Orders
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your active pickups, incoming delivery offers, and completed drops.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchOrders(tab)}
            disabled={loading}
            className="rounded-xl text-xs gap-1.5"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <Link href="/riderapp/settings">
            <Button variant="outline" size="sm" className="text-xs rounded-xl gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              Delivery Zones
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto">
        {[
          { id: "active", label: "Active Deliveries" },
          { id: "offered", label: "New Offers" },
          { id: "completed", label: "Completed" },
          { id: "all", label: "All History" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={cn(
              "px-4 py-2 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap",
              tab === t.id
                ? "bg-blue-600 text-white shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      {loading && assignments.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
          Loading delivery assignments...
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-600">
          {error}
        </div>
      ) : assignments.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed rounded-3xl bg-card border-border/80 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center mx-auto">
            <Bike className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground">
              {tab === "offered"
                ? "No New Delivery Offers"
                : tab === "active"
                ? "No Active Deliveries"
                : "No Orders Found"}
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              {tab === "offered"
                ? "When stores in your zone request product deliveries, high-priority offers will appear here."
                : tab === "active"
                ? "You currently have no ongoing deliveries. Check 'New Offers' or keep your GPS active to receive orders."
                : "Completed and archived deliveries will be listed here."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assignments.map((assignment) => {
            const order = assignment.order
            const shopName =
              order?.seller?.store?.name ||
              order?.seller?.businessInfo?.businessName ||
              "Seller Store"
            const shopPhone =
              order?.seller?.user?.phone ||
              order?.seller?.businessInfo?.pocContact ||
              ""
            const customerName =
              order?.shippingFullName || order?.customer?.name || "Customer"
            const customerPhone =
              order?.shippingPhone || order?.customer?.phone || ""
            const dropAddress = [
              order?.shippingAddressLine1,
              order?.shippingCity,
            ]
              .filter(Boolean)
              .join(", ")

            const isOffered = assignment.status === "OFFERED"
            const isDelivered = assignment.status === "DELIVERED"

            return (
              <div
                key={assignment.id}
                className={cn(
                  "p-5 rounded-3xl border bg-card transition-all space-y-4 shadow-xs",
                  isOffered
                    ? "border-amber-400 dark:border-amber-600/60 ring-2 ring-amber-400/20 bg-amber-50/20 dark:bg-amber-950/10"
                    : "border-border/80"
                )}
              >
                {/* Top Badge & Order Ref */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-foreground">
                      #{order?.orderNumber || assignment.orderId.slice(-6)}
                    </span>
                    {assignment.distanceKm && (
                      <Badge variant="outline" className="text-[10px] rounded-lg">
                        {assignment.distanceKm} km away
                      </Badge>
                    )}
                  </div>
                  <Badge
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full capitalize",
                      isOffered
                        ? "bg-amber-500 text-white"
                        : assignment.status === "DELIVERED"
                        ? "bg-green-600 text-white"
                        : "bg-blue-600 text-white"
                    )}
                  >
                    {assignment.status.replace(/_/g, " ")}
                  </Badge>
                </div>

                {/* Pickup & Drop Points */}
                <div className="space-y-2.5 text-xs">
                  {/* Store Pickup */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Store className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-foreground truncate">
                        {shopName}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        Pickup Store {shopPhone ? `• ${shopPhone}` : ""}
                      </div>
                    </div>
                  </div>

                  {/* Customer Drop */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-foreground truncate">
                        {customerName}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {dropAddress || "Delivery Address"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items preview & Delivery Earning */}
                <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">
                    {order?.items?.length || 1} item{(order?.items?.length || 1) > 1 ? "s" : ""}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Delivery Earning:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      Le {Number(order?.shipping || order?.items?.reduce((s: number, i: any) => s + (i.shippingAmount || 0), 0) || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-1">
                  {isOffered ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAccept(assignment.id)}
                        disabled={actionLoading === assignment.id}
                        className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                      >
                        Accept Offer
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(assignment.id)}
                        disabled={actionLoading === assignment.id}
                        className="rounded-xl text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200 dark:border-red-900"
                      >
                        Decline
                      </Button>
                    </div>
                  ) : (
                    <Link href={`/riderapp/orders/${assignment.id}`}>
                      <Button
                        size="sm"
                        className="w-full rounded-xl text-xs font-semibold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {isDelivered ? "View Summary" : "Open Live Delivery"}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
