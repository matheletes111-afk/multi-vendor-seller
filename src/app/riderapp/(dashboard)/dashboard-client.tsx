"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import {
  Bike,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Settings,
  Package,
  ShieldCheck,
  Power,
  RefreshCw,
  Phone,
  Mail,
  Truck,
  ExternalLink,
  Laptop,
  Smartphone,
} from "lucide-react"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { cn } from "@/lib/utils"

export function RiderDashboardClient({ user: initialUser }: { user: any }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(true)

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/riderapp/settings")
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const rider = data?.rider
  const user = data?.user || initialUser

  const selectedZones = (rider?.selectedZones as string[]) || []
  const selectedLocations = (rider?.selectedLocations as string[]) || []
  const vehicleTypes = (rider?.vehicleTypes as string[]) || []
  const deviceTokens = (rider?.deviceTokens as any[]) || []

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Welcome & Online Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-linear-to-r from-blue-600 to-indigo-700 text-white rounded-3xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center font-bold text-xl overflow-hidden shrink-0">
            {user?.image || rider?.profileImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={user?.image || rider?.profileImage}
                alt={user?.name || "Rider"}
                className="w-full h-full object-cover"
              />
            ) : (
              (user?.name?.[0] || user?.email?.[0] || "R").toUpperCase()
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                Welcome, {user?.name || "Rider"}!
              </h1>
              <Badge className="bg-white/20 text-white hover:bg-white/30 border-0 text-xs">
                {rider?.status === "APPROVED" ? "Verified Rider" : rider?.status || "Active"}
              </Badge>
            </div>
            <p className="text-xs text-blue-100 mt-1 flex items-center gap-3 flex-wrap">
              <span>{user?.email}</span>
              {user?.phone && <span>• {user?.phoneCountryCode} {user?.phone}</span>}
            </p>
          </div>
        </div>

        {/* Online / Offline Toggle */}
        <div className="flex items-center gap-3 shrink-0 bg-white/10 backdrop-blur p-2.5 rounded-2xl border border-white/15">
          <button
            type="button"
            onClick={() => setIsOnline(!isOnline)}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all shadow-xs",
              isOnline
                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            )}
          >
            <Power className="w-3.5 h-3.5" />
            {isOnline ? "Available for Orders" : "Offline"}
          </button>
        </div>
      </div>

      {/* Rejection / Correction Alert Banner */}
      {rider?.status === "REJECTED" && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-900 dark:text-rose-200 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4" />
              Document Correction Requested by Admin
            </div>
            <p>{rider?.adminFeedback || "Please review your documents and update your details in Settings."}</p>
          </div>
          <Link href="/riderapp/settings">
            <Button size="sm" variant="outline" className="text-xs rounded-xl border-rose-300 shrink-0">
              Update in Settings
            </Button>
          </Link>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="p-5 rounded-2xl bg-linear-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total Earnings</span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">
            Le {Number(data?.stats?.totalEarnings || 0).toLocaleString()}
          </div>
          <p className="text-[11px] text-emerald-600 font-semibold">
            {data?.stats?.completedDeliveriesCount || 0} completed deliveries
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-card border shadow-xs space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Active Delivery Zones</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {selectedZones.length} <span className="text-xs text-muted-foreground font-normal">zones</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Covering {selectedLocations.length} locations
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-card border shadow-xs space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Vehicle Fleet</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600">
              <Bike className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {vehicleTypes.length} <span className="text-xs text-muted-foreground font-normal">types</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {vehicleTypes.map((v) => (
              <Badge key={v} variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                {v.replace("_", " ")}
              </Badge>
            ))}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-card border shadow-xs space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">KYC Verification</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {rider?.isApproved ? "Approved" : "Pending"}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {rider?.drivingLicenseDoc ? "Documents uploaded" : "Incomplete docs"}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-card border shadow-xs space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Registered Devices</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600">
              <Laptop className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {deviceTokens.length} <span className="text-xs text-muted-foreground font-normal">devices</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Ready for push notifications
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-card border shadow-xs space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Ongoing Pickups</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {data?.stats?.activeDeliveriesCount || 0}
          </div>
          <p className="text-[11px] text-muted-foreground">
            In-progress delivery tasks
          </p>
        </div>
      </div>

      {/* Main Action Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: Delivery Coverage */}
        <div className="md:col-span-2 p-6 rounded-3xl bg-card border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                Active Delivery Coverage
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Orders from these zones will be routed to your delivery dispatch queue.
              </p>
            </div>
            <Link href="/riderapp/settings">
              <Button variant="outline" size="sm" className="text-xs rounded-xl gap-1">
                <Settings className="w-3.5 h-3.5" />
                Edit Zones
              </Button>
            </Link>
          </div>

          {selectedZones.length === 0 ? (
            <div className="p-8 text-center border border-dashed rounded-2xl text-muted-foreground text-xs space-y-2">
              <MapPin className="w-8 h-8 mx-auto text-slate-300" />
              <p className="font-semibold text-foreground">No delivery zones selected</p>
              <p>Configure your delivery zones in Settings to start receiving order dispatches.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
              {selectedZones.map((zone) => (
                <div key={zone} className="p-3 rounded-xl border bg-muted/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-blue-600" />
                    <span className="font-bold text-xs text-foreground">{zone}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">Active</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Col: Quick Settings & Profile Summary */}
        <div className="p-6 rounded-3xl bg-card border shadow-xs space-y-5">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Settings className="w-4 h-4 text-blue-600" />
              Account & Security
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Keep your profile and vehicle details up to date.
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl border bg-muted/20 flex items-center justify-between">
              <div>
                <span className="font-semibold text-foreground block">Vehicle Plate</span>
                <span className="text-muted-foreground text-[11px] font-mono">
                  {rider?.vehicleNumber || "Not provided"}
                </span>
              </div>
              <Bike className="w-4 h-4 text-muted-foreground" />
            </div>

            <div className="p-3 rounded-xl border bg-muted/20 flex items-center justify-between">
              <div>
                <span className="font-semibold text-foreground block">License Number</span>
                <span className="text-muted-foreground text-[11px] font-mono">
                  {rider?.drivingLicenseNo || "Not provided"}
                </span>
              </div>
              <ShieldCheck className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          <Link href="/riderapp/settings" className="block pt-2">
            <Button className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 shadow-sm">
              <Settings className="w-3.5 h-3.5" />
              Manage All Settings
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
