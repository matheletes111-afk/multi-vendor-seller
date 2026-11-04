"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import {
  CreditCard,
  Check,
  Sparkles,
  AlertCircle,
  Calendar,
  Layers,
  ShieldCheck,
  Clock,
  Gift,
  RefreshCw,
  PlusCircle,
  Loader2,
  CheckCircle2,
  Tag,
} from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"

interface SellerSubscriptionDetailsCardProps {
  subscription?: any
  purchases?: any[]
  plans?: any[]
  sellerType?: "PRODUCT" | "SERVICE" | "HOTEL" | "RESTAURANT" | string
  sellerId?: string
  onRefresh?: () => void
}

export function SellerSubscriptionDetailsCard({
  subscription,
  purchases = [],
  plans = [],
  sellerType = "PRODUCT",
  sellerId,
  onRefresh,
}: SellerSubscriptionDetailsCardProps) {
  const [isGrantDialogOpen, setIsGrantDialogOpen] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState<string>("")
  const [customDays, setCustomDays] = useState<string>("30")
  const [grantNote, setGrantNote] = useState<string>("")
  const [isGranting, setIsGranting] = useState(false)
  const [grantError, setGrantError] = useState<string | null>(null)
  const [grantSuccess, setGrantSuccess] = useState<string | null>(null)

  const activePlan = subscription?.plan
  const status = subscription?.status || "INACTIVE"

  // Days Remaining calculation
  const now = new Date()
  const periodEnd = subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null
  const daysLeft = periodEnd
    ? Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : 0

  const isActuallyActive = (status === "ACTIVE" || status === "TRIALING") && daysLeft > 0

  const queuedPurchases = (purchases || []).filter((p) => p.status === "QUEUED")
  const activePurchase = (purchases || []).find((p) => p.status === "ACTIVE")

  const getLimitLabel = (p: any) => {
    if (sellerType === "HOTEL") {
      const hotels = p.maxProducts != null ? `${p.maxProducts} Hotels` : "Unlimited Hotels"
      const rooms = p.maxRooms != null ? `${p.maxRooms} Rooms` : "Unlimited Rooms"
      return `${hotels}, ${rooms}`
    }
    if (sellerType === "RESTAURANT") {
      return p.maxProducts != null ? `${p.maxProducts} Menu Items Max` : "Unlimited Menu Items"
    }
    if (sellerType === "SERVICE") {
      return p.maxProducts != null ? `${p.maxProducts} Services Max` : "Unlimited Services"
    }
    return p.maxProducts != null ? `${p.maxProducts} Products Max` : "Unlimited Products"
  }

  const getStatusBadge = (st: string) => {
    if (st?.toUpperCase() === "ACTIVE" || st?.toUpperCase() === "TRIALING") {
      if (daysLeft > 0) {
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold px-2.5 py-0.5">
            🟢 Active ({daysLeft} {daysLeft === 1 ? "Day" : "Days"} Left)
          </Badge>
        )
      } else {
        return (
          <Badge variant="destructive" className="font-bold px-2.5 py-0.5">
            🔴 Expired (Hidden from Marketplace)
          </Badge>
        )
      }
    }
    if (st?.toUpperCase() === "IN_GRACE_PERIOD") {
      return <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-bold">⚠️ In Grace Period</Badge>
    }
    if (st?.toUpperCase() === "EXPIRED" || st?.toUpperCase() === "CANCELED") {
      return <Badge variant="destructive" className="font-bold">🔴 Expired / Inactive</Badge>
    }
    return <Badge variant="outline" className="bg-slate-100 text-slate-700">No Active Plan</Badge>
  }

  // Handle Admin Grant
  const handleGrantPlan = async () => {
    if (!sellerId || !selectedPlanId) return
    setIsGranting(true)
    setGrantError(null)
    setGrantSuccess(null)

    try {
      const res = await fetch("/api/admin/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerType:
            sellerType === "HOTEL"
              ? "HOTEL"
              : sellerType === "RESTAURANT"
              ? "RESTAURANT"
              : "PRODUCT_SERVICE",
          sellerId,
          planId: selectedPlanId,
          durationDays: parseInt(customDays, 10) || 30,
          note: grantNote || "Admin Granted Pack",
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to grant subscription")
      }

      setGrantSuccess("Subscription pack granted and applied successfully!")
      setTimeout(() => {
        setIsGrantDialogOpen(false)
        setGrantSuccess(null)
        if (onRefresh) {
          onRefresh()
        } else {
          window.location.reload()
        }
      }, 1200)
    } catch (err: any) {
      setGrantError(err?.message || "Failed to grant subscription")
    } finally {
      setIsGranting(false)
    }
  }

  return (
    <Card className="border border-muted/50 shadow-xl bg-background rounded-3xl overflow-hidden flex flex-col border-l-4 border-l-purple-500/40">
      <CardHeader className="bg-muted/30 pb-4 border-b border-muted/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-purple-600 dark:text-purple-400">
            <CreditCard className="h-4 w-4" /> Subscription & Recharge Status
          </CardTitle>
          <div className="flex items-center gap-2">
            {getStatusBadge(status)}
            {sellerId && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs font-bold rounded-xl border-purple-200 text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/40 gap-1"
                onClick={() => {
                  setSelectedPlanId(plans[0]?.id || "")
                  setIsGrantDialogOpen(true)
                }}
              >
                <PlusCircle className="h-3.5 w-3.5" />
                Grant / Extend
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6 flex-1">
        {/* CURRENT PLAN BOX */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/5 via-indigo-500/5 to-slate-500/5 border border-purple-500/15 relative overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 block mb-1">
                Current Assigned Package
              </span>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {activePlan?.displayName || activePlan?.name || "Free Starter Package"}
                {activePlan?.price === 0 && (
                  <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">
                    Go-Live Free Trial
                  </Badge>
                )}
              </h4>
            </div>
            <div className="text-right">
              <span className="text-xl font-extrabold text-slate-900 dark:text-white">
                {activePurchase?.paidPrice != null ? (activePurchase.paidPrice > 0 ? formatCurrency(activePurchase.paidPrice) : "Free") : (activePlan?.price === 0 ? "Free" : formatCurrency(activePlan?.price ?? 0))}
              </span>
              {activePurchase?.couponCode && (
                <div className="mt-1">
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 text-[10px] font-bold">
                    <Tag className="h-2.5 w-2.5 mr-1 text-purple-600" />
                    {activePurchase.couponCode} (-{formatCurrency(activePurchase.discountAmount || 0)})
                  </Badge>
                </div>
              )}
              {activePlan?.duration && (
                <span className="text-xs text-muted-foreground block">
                  / {activePlan.duration} Days
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-purple-500/10">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium text-muted-foreground">Listing Limit</span>
              <span className="text-xs font-semibold text-purple-900 dark:text-purple-200">
                {activePlan ? getLimitLabel(activePlan) : "Unlimited"}
              </span>
            </div>

            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium text-muted-foreground">Monthly Orders</span>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {activePlan?.maxOrders != null ? `${activePlan.maxOrders} Orders` : "Unlimited Orders"}
              </span>
            </div>

            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium text-muted-foreground">End Date</span>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {subscription?.currentPeriodEnd
                  ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                  : "—"}
              </span>
            </div>

            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium text-muted-foreground">Marketplace State</span>
              <span className={cn(
                "text-xs font-bold",
                isActuallyActive ? "text-emerald-600" : "text-rose-600"
              )}>
                {isActuallyActive ? "Live & Searchable" : "Hidden (Expired)"}
              </span>
            </div>
          </div>
        </div>

        {/* QUEUED PACKS SECTION */}
        {queuedPurchases.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                Queued Prepaid Packs ({queuedPurchases.length})
              </span>
              <Badge className="bg-blue-600 text-white text-[10px]">Autostart On Expiry</Badge>
            </div>
            {queuedPurchases.map((qp) => (
              <div key={qp.id} className="text-xs flex items-center justify-between pt-1 border-t border-blue-200/50">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {qp.plan?.displayName || qp.plan?.name} ({qp.durationDays} days)
                </span>
                <span className="text-slate-600 dark:text-slate-400">
                  Paid: {qp.paidPrice > 0 ? formatCurrency(qp.paidPrice) : "Free/Admin"} • {qp.paymentMethod}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ALL SYSTEM PLANS STATUS FOR THIS SELLER TYPE */}
        {plans.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-purple-500" /> Available System Plans & Status ({plans.length})
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((p) => {
                const isSelected = activePlan?.id === p.id
                const isQueued = queuedPurchases.some((qp) => qp.planId === p.id)

                return (
                  <div
                    key={p.id}
                    className={cn(
                      "p-3 rounded-2xl border transition-all text-left flex flex-col justify-between space-y-2",
                      isSelected
                        ? "border-purple-500 bg-purple-50/50 dark:bg-purple-950/20 shadow-sm"
                        : isQueued
                        ? "border-blue-400 bg-blue-50/40 dark:bg-blue-950/20"
                        : "border-muted/60 bg-muted/20 hover:border-muted"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {p.displayName || p.name}
                        </span>
                        {isSelected && (
                          <Badge className="bg-purple-600 text-white text-[9px] px-1.5 py-0 h-4">
                            Active
                          </Badge>
                        )}
                        {isQueued && !isSelected && (
                          <Badge className="bg-blue-600 text-white text-[9px] px-1.5 py-0 h-4">
                            Queued
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm font-extrabold text-purple-700 dark:text-purple-300">
                        {p.price === 0 ? "Free" : `$${p.price}`}
                        <span className="text-[10px] font-normal text-muted-foreground">
                          {" "}
                          / {p.duration || 30}d
                        </span>
                      </span>
                    </div>

                    <div className="text-[11px] text-muted-foreground space-y-1 pt-1 border-t border-muted/40">
                      <div className="flex items-center gap-1">
                        <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                        <span className="truncate">{getLimitLabel(p)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                        <span>{p.maxOrders != null ? `${p.maxOrders} orders` : "Unlimited orders"}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* PURCHASE & RECHARGE LEDGER TABLE */}
        {purchases.length > 0 && (
          <div className="space-y-3 pt-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-purple-500" /> Subscription Recharge History ({purchases.length})
            </span>
            <div className="border border-muted/50 rounded-2xl overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-muted/30">
                  <tr>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Plan</th>
                    <th className="p-2.5">Duration</th>
                    <th className="p-2.5">Coupon</th>
                    <th className="p-2.5">Paid</th>
                    <th className="p-2.5">Method</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted/30">
                  {purchases.slice(0, 10).map((pch) => (
                    <tr key={pch.id} className="hover:bg-muted/10">
                      <td className="p-2.5 text-slate-600 dark:text-slate-400">
                        {new Date(pch.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                        {pch.plan?.displayName || pch.plan?.name || "Pack"}
                      </td>
                      <td className="p-2.5 text-slate-600 dark:text-slate-400">
                        {pch.durationDays} days
                      </td>
                      <td className="p-2.5">
                        {pch.couponCode ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-purple-700 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800 px-2 py-0.5 rounded-full font-bold">
                            <Tag className="h-2.5 w-2.5 text-purple-600" />
                            {pch.couponCode} (-{formatCurrency(pch.discountAmount || 0)})
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="p-2.5 font-semibold text-slate-900 dark:text-white">
                        {pch.paidPrice > 0 ? formatCurrency(pch.paidPrice) : "Free"}
                      </td>
                      <td className="p-2.5">
                        <Badge variant="outline" className="text-[10px]">
                          {pch.paymentMethod}
                        </Badge>
                      </td>
                      <td className="p-2.5">
                        <Badge
                          className={cn(
                            "text-[10px] font-bold",
                            pch.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-800"
                              : pch.status === "QUEUED"
                              ? "bg-blue-100 text-blue-800"
                              : pch.status === "EXPIRED"
                              ? "bg-slate-100 text-slate-700"
                              : "bg-red-100 text-red-800"
                          )}
                        >
                          {pch.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>

      {/* ADMIN GRANT / EXTEND PACK MODAL */}
      <Dialog open={isGrantDialogOpen} onOpenChange={setIsGrantDialogOpen}>
        <DialogContent className="sm:max-w-[440px] p-6 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <Gift className="w-5 h-5 text-purple-600" />
              Grant / Extend Subscription Pack
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Manually recharge this seller store. If they currently have an active plan, this will queue or stack per system policy.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold">Select Plan</label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Choose a plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.displayName || p.name} ({p.duration || 30} days) - ${p.price}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold">Validity Duration (Days)</label>
              <Input
                type="number"
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
                placeholder="30"
                className="h-10 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold">Admin Reason / Note (Optional)</label>
              <Input
                value={grantNote}
                onChange={(e) => setGrantNote(e.target.value)}
                placeholder="e.g. Complimentary VIP extension"
                className="h-10 rounded-xl"
              />
            </div>

            {grantError && (
              <div className="p-2.5 rounded-xl bg-red-50 text-red-600 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{grantError}</span>
              </div>
            )}

            {grantSuccess && (
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{grantSuccess}</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-xl text-xs h-10"
              onClick={() => setIsGrantDialogOpen(false)}
              disabled={isGranting}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl text-xs font-bold h-10 bg-purple-600 hover:bg-purple-700 text-white"
              onClick={handleGrantPlan}
              disabled={isGranting || !selectedPlanId}
            >
              {isGranting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Granting...
                </>
              ) : (
                "Grant Subscription"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
