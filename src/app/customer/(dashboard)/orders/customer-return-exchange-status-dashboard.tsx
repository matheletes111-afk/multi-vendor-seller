"use client"

import { useMemo, type CSSProperties } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import type { OrderDetailItemApi } from "@/app/api/customer/orders/types"
import {
  ArrowLeftRight,
  Banknote,
  CheckCircle2,
  Circle,
  Info,
  MessageCircle,
  Package,
  RotateCcw,
  Truck,
  Undo2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { exchangeTopUpCodLabel } from "@/lib/exchange-top-up-display"

const C = {
  success: "#10b981",
  pending: "#f59e0b",
  info: "#3b82f6",
  error: "#ef4444",
  muted: "#6b7280",
} as const

function statusPillStyle(hex: string): CSSProperties {
  return {
    backgroundColor: `${hex}18`,
    color: hex,
    borderColor: `${hex}55`,
  }
}

function returnDisplayStatus(
  item: OrderDetailItemApi,
): { label: string; color: string } {
  if (item.itemStatus === "REFUNDED" && item.refundStatus === "COMPLETED") {
    return { label: "Completed", color: C.success }
  }
  const rs = item.returnRequestStatus
  if (!rs && item.returnAvailable) {
    return { label: "Eligible", color: C.info }
  }
  if (!rs) {
    return { label: "—", color: C.muted }
  }
  const u = rs.toUpperCase()
  if (u === "REQUESTED") return { label: "Requested", color: C.pending }
  if (u === "ACCEPTED") return { label: "Return approved", color: C.success }
  if (u === "REJECTED") return { label: "Rejected", color: C.error }
  return { label: u.replace(/_/g, " "), color: C.muted }
}

function exchangeDisplay(item: OrderDetailItemApi): { label: string; color: string; detail: string | null } {
  if (item.returnResolutionType === "EXCHANGE") {
    const st = item.returnRequestStatus
    if (st === "REQUESTED") return { label: "Requested", color: C.pending, detail: null }
    if (st === "ACCEPTED") return { label: "Exchange approved", color: C.success, detail: null }
    if (st === "REJECTED") return { label: "Rejected", color: C.error, detail: null }
    if (item.replacementOrderItemId) {
      return { label: "In progress", color: C.info, detail: "Replacement line on this order" }
    }
    return { label: "Eligible", color: C.info, detail: null }
  }
  if (item.replacementAllowed) {
    return { label: "Eligible", color: C.info, detail: null }
  }
  return { label: "—", color: C.muted, detail: null }
}

function pickupDisplay(item: OrderDetailItemApi): { label: string; color: string } {
  const s = (item.pickupStatus ?? "NOT_REQUESTED").toUpperCase()
  if (s === "NOT_REQUESTED") return { label: "NOT REQUESTED", color: C.muted }
  if (s === "PENDING") return { label: "SCHEDULED", color: C.info }
  if (s === "COMPLETED") return { label: "COMPLETED", color: C.success }
  return { label: s.replace(/_/g, " "), color: C.muted }
}

function refundDisplay(item: OrderDetailItemApi): { label: string; color: string } {
  const s = (item.refundStatus ?? "NOT_REQUESTED").toUpperCase()
  if (s === "NOT_REQUESTED") return { label: "NOT REQUESTED", color: C.muted }
  if (s === "PENDING") return { label: "PENDING", color: C.pending }
  if (s === "COMPLETED") return { label: "COMPLETED", color: C.success }
  return { label: s.replace(/_/g, " "), color: C.muted }
}

type TimelineStep = {
  key: string
  label: string
  done: boolean
  current: boolean
}

/**
 * Refund return: one pickup step (not split into “scheduled” vs “completed” incorrectly).
 * Exchange: pickup of original item, then replacement delivery (pickup auto-completes when replacement is delivered).
 */
function buildCustomerReturnTimeline(
  item: OrderDetailItemApi,
  replacementLine: OrderDetailItemApi | null | undefined,
): TimelineStep[] {
  const rs = item.returnRequestStatus?.toUpperCase()
  const ps = (item.pickupStatus ?? "NOT_REQUESTED").toUpperCase()
  const fs = (item.refundStatus ?? "NOT_REQUESTED").toUpperCase()
  const isExchange = item.returnResolutionType === "EXCHANGE"

  if (isExchange) {
    const rep = replacementLine?.itemStatus?.toUpperCase() ?? ""
    const repDelivered = rep === "DELIVERED"

    const raw: Omit<TimelineStep, "current">[] = [
      { key: "e1", label: "Return request submitted", done: !!rs },
      { key: "e2", label: "Return & exchange approved", done: rs === "ACCEPTED" },
      { key: "e3", label: "Pickup of your original item", done: ps === "COMPLETED" },
      { key: "e4", label: "Replacement delivered to you", done: repDelivered },
    ]

    const firstIncomplete = raw.findIndex((s) => !s.done)
    const activeIdx = firstIncomplete === -1 ? -1 : firstIncomplete

    return raw.map((s, i) => ({
      ...s,
      current: activeIdx >= 0 && !s.done && i === activeIdx,
    }))
  }

  const raw: Omit<TimelineStep, "current">[] = [
    { key: "r1", label: "Return request submitted", done: !!rs },
    { key: "r2", label: "Return approved", done: rs === "ACCEPTED" },
    { key: "r3", label: "Pickup of original item", done: ps === "COMPLETED" },
    { key: "r4", label: "Refund processed", done: fs === "COMPLETED" },
  ]

  const firstIncomplete = raw.findIndex((s) => !s.done)
  const activeIdx = firstIncomplete === -1 ? -1 : firstIncomplete

  return raw.map((s, i) => ({
    ...s,
    current: activeIdx >= 0 && !s.done && i === activeIdx,
  }))
}

export type CustomerReturnExchangeStatusDashboardProps = {
  item: OrderDetailItemApi
  /** New line item for an exchange (same order), for replacement delivery step. */
  replacementLine?: OrderDetailItemApi | null
  /** Anchor id for scroll (e.g. Track return) */
  sectionId: string
  returnWindowText: string | null
  daysLeft: number | null
  formatCurrency: (amount: number) => string
  lineTotal: number
  onRequestRefund: () => void
  onRequestExchange: () => void
  returnLoadingItemId: string | null
  exchangeOptionsLoading: boolean
  exchangeItemId: string | null
  /** Order detail page uses "Request return"; inline uses "Request refund". */
  requestRefundLabel?: "Request return" | "Request refund"
  /** Inline order drawer used "Exchange item". */
  requestExchangeLabel?: string
  compact?: boolean
}

export function CustomerReturnExchangeStatusDashboard({
  item,
  replacementLine = null,
  sectionId,
  returnWindowText,
  daysLeft,
  formatCurrency,
  lineTotal,
  onRequestRefund,
  onRequestExchange,
  returnLoadingItemId,
  exchangeOptionsLoading,
  exchangeItemId,
  requestRefundLabel = "Request return",
  requestExchangeLabel = "Request exchange",
  compact = false,
}: CustomerReturnExchangeStatusDashboardProps) {
  const lastUpdated = useMemo(() => {
    const h = item.statusHistory
    if (!h.length) return null
    return h[h.length - 1]!.createdAt
  }, [item.statusHistory])

  const headerBadge = useMemo(() => {
    if (item.returnRequestStatus) {
      const u = item.returnRequestStatus.toUpperCase()
      if (u === "REQUESTED") {
        if (item.returnResolutionType === "EXCHANGE") {
          return { text: "Return & exchange requested", style: statusPillStyle(C.pending) }
        }
        return { text: "Return requested", style: statusPillStyle(C.pending) }
      }
      if (u === "ACCEPTED") {
        if (item.returnResolutionType === "EXCHANGE") {
          return { text: "Return approved · Exchange approved", style: statusPillStyle(C.success) }
        }
        return { text: "Return approved", style: statusPillStyle(C.success) }
      }
      if (u === "REJECTED") {
        return { text: "Return rejected", style: statusPillStyle(C.error) }
      }
    }
    if (item.returnAvailable && daysLeft != null && daysLeft >= 0) {
      return {
        text: `Return eligible (${daysLeft} day${daysLeft === 1 ? "" : "s"} left)`,
        style: statusPillStyle(C.info),
      }
    }
    if (item.returnAvailable) {
      return { text: "Return eligible", style: statusPillStyle(C.info) }
    }
    return null
  }, [item.returnAvailable, item.returnRequestStatus, item.returnResolutionType, daysLeft])

  const ret = returnDisplayStatus(item)
  const ex = exchangeDisplay(item)
  const pu = pickupDisplay(item)
  const rf = refundDisplay(item)

  const showTimeline =
    !!item.returnRequestStatus && item.returnRequestStatus !== "REJECTED"

  const pad = compact ? "p-3" : "p-4"
  const gridGap = compact ? "gap-2" : "gap-3"
  const titleSize = compact ? "text-base" : "text-lg"

  return (
    <Card
      id={sectionId}
      className="border-gray-200 bg-white shadow-md transition-shadow hover:shadow-lg"
    >
      <CardHeader className={cn("pb-2", compact && "px-4 pt-4")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle
              className={cn("flex items-center gap-2 font-semibold text-gray-900", titleSize)}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600 ring-1 ring-orange-100">
                <Undo2 className="h-5 w-5" aria-hidden />
              </span>
              Return &amp; Exchange Status
            </CardTitle>
            {lastUpdated && (
              <p className="text-xs text-gray-500">
                Status last updated:{" "}
                <time dateTime={lastUpdated}>{new Date(lastUpdated).toLocaleString()}</time>
              </p>
            )}
          </div>
          {headerBadge && (
            <span
              className="inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold"
              style={headerBadge.style}
            >
              {headerBadge.text}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className={cn("space-y-4", compact && "px-4 pb-4")}>
        <div
          className={cn(
            "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
            gridGap,
          )}
        >
          <button
            type="button"
            title="Return status for this item."
            className={cn(
              "group rounded-xl border border-gray-200 bg-gray-50/80 text-left shadow-sm transition-all duration-200 hover:border-orange-200 hover:shadow-md",
              pad,
            )}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-orange-600 shadow-sm ring-1 ring-gray-100 transition-transform group-hover:scale-105">
                <RotateCcw className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Return status
                </p>
                <p
                  className="mt-1 inline-flex max-w-full rounded-full border px-2.5 py-0.5 text-xs font-bold tracking-wide"
                  style={statusPillStyle(ret.color)}
                >
                  {ret.label}
                </p>
                {ret.label === "Eligible" && daysLeft != null && daysLeft >= 0 && returnWindowText && (
                  <p className="mt-2 text-xs text-gray-600">
                    Window closes {returnWindowText} ({daysLeft} day{daysLeft === 1 ? "" : "s"} left)
                  </p>
                )}
              </div>
            </div>
          </button>

          <button
            type="button"
            title="Exchange status for this item."
            className={cn(
              "group rounded-xl border border-gray-200 bg-gray-50/80 text-left shadow-sm transition-all duration-200 hover:border-blue-200 hover:shadow-md",
              pad,
            )}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm ring-1 ring-gray-100 transition-transform group-hover:scale-105">
                <ArrowLeftRight className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Exchange status
                </p>
                <p
                  className="mt-1 inline-flex max-w-full rounded-full border px-2.5 py-0.5 text-xs font-bold tracking-wide"
                  style={statusPillStyle(ex.color)}
                >
                  {ex.label}
                </p>
                {item.returnResolutionType === "EXCHANGE" && (item.exchangeTopUpAmount ?? 0) > 0 && (
                  <p className="mt-2 text-xs text-amber-800">
                    Extra for upgrade: {formatCurrency(item.exchangeTopUpAmount)} —{" "}
                    {exchangeTopUpCodLabel(item.exchangeTopUpStatus, true)}
                  </p>
                )}
                {item.returnResolutionType === "EXCHANGE" && (item.exchangeRefundDifferenceAmount ?? 0) > 0 && (
                  <p className="mt-1 text-xs text-blue-800">
                    Wallet credit: {formatCurrency(item.exchangeRefundDifferenceAmount)} (
                    {item.exchangeRefundDifferenceStatus ?? "—"})
                  </p>
                )}
                {ex.detail && <p className="mt-1 text-xs text-gray-600">{ex.detail}</p>}
              </div>
            </div>
          </button>

          <button
            type="button"
            title="Pickup status for this return."
            className={cn(
              "group rounded-xl border border-gray-200 bg-gray-50/80 text-left shadow-sm transition-all duration-200 hover:border-slate-200 hover:shadow-md",
              pad,
            )}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-slate-700 shadow-sm ring-1 ring-gray-100 transition-transform group-hover:scale-105">
                <Truck className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {item.returnResolutionType === "EXCHANGE" ? "Original item pickup" : "Pickup status"}
                </p>
                <p
                  className="mt-1 inline-flex max-w-full rounded-full border px-2.5 py-0.5 text-xs font-bold tracking-wide"
                  style={statusPillStyle(pu.color)}
                >
                  {pu.label}
                </p>
                {item.returnResolutionType === "EXCHANGE" && item.pickupStatus === "NOT_REQUESTED" && item.returnRequestStatus === "ACCEPTED" && (
                  <p className="mt-2 text-xs text-amber-800">
                    Not picked up yet — your seller will arrange pickup of the old item.
                  </p>
                )}
                {item.pickupStatus === "PENDING" && (
                  <p className="mt-2 text-xs text-gray-600">
                    {item.returnResolutionType === "EXCHANGE"
                      ? "Pickup scheduled — hand over the original item when your seller or courier visits."
                      : "Pickup has been scheduled with your seller."}
                  </p>
                )}
                {item.returnResolutionType === "EXCHANGE" && item.pickupStatus === "COMPLETED" && (
                  <p className="mt-2 text-xs text-emerald-800">Original item has been picked up.</p>
                )}
              </div>
            </div>
          </button>

          <button
            type="button"
            title="Refund status for this item."
            className={cn(
              "group rounded-xl border border-gray-200 bg-gray-50/80 text-left shadow-sm transition-all duration-200 hover:border-emerald-200 hover:shadow-md",
              pad,
            )}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 shadow-sm ring-1 ring-gray-100 transition-transform group-hover:scale-105">
                <Banknote className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {item.returnResolutionType === "EXCHANGE" ? "Payment refund" : "Refund status"}
                </p>
                <p
                  className="mt-1 inline-flex max-w-full rounded-full border px-2.5 py-0.5 text-xs font-bold tracking-wide"
                  style={statusPillStyle(rf.color)}
                >
                  {rf.label}
                </p>
                {item.refundStatus === "COMPLETED" && (
                  <p className="mt-2 text-xs font-medium text-emerald-800">
                    Amount: {formatCurrency(lineTotal)}
                  </p>
                )}
                {item.returnResolutionType === "EXCHANGE" && (
                  <p className="mt-2 text-xs text-gray-600">
                    Exchanges do not refund to your card. Wallet credit for a cheaper replacement appears under Exchange
                    status when applicable.
                  </p>
                )}
                {item.returnResolutionType !== "EXCHANGE" && item.refundStatus === "PENDING" && (
                  <p className="mt-2 text-xs text-gray-600">Refund is being processed.</p>
                )}
              </div>
            </div>
          </button>
        </div>

        {returnWindowText && item.returnAvailable && !item.returnRequestStatus && (
          <p className="text-sm text-gray-600">
            Return available until{" "}
            <span className="font-medium text-gray-900">{returnWindowText}</span>
          </p>
        )}

        {item.itemStatus === "DELIVERED" && !item.returnRequestStatus && (
          <div
            className={cn(
              "flex flex-col gap-2 sm:flex-row",
              compact ? "sm:flex-wrap" : "",
            )}
          >
            <Button
              size={compact ? "default" : "lg"}
              className={cn(
                "w-full rounded-lg bg-orange-600 font-semibold text-white shadow-sm hover:bg-orange-700 sm:w-auto",
                compact && "sm:min-w-[140px]",
              )}
              onClick={onRequestRefund}
              disabled={returnLoadingItemId === item.id || exchangeOptionsLoading}
            >
              {returnLoadingItemId === item.id ? "Requesting..." : requestRefundLabel}
            </Button>
            {item.replacementAllowed && (
              <Button
                size={compact ? "default" : "lg"}
                variant="default"
                className={cn(
                  "w-full rounded-lg bg-blue-600 font-semibold text-white hover:bg-blue-700 sm:w-auto",
                  compact && "sm:min-w-[140px]",
                )}
                onClick={onRequestExchange}
                disabled={returnLoadingItemId === item.id || exchangeOptionsLoading}
              >
                {exchangeOptionsLoading && exchangeItemId === item.id ? "Loading…" : requestExchangeLabel}
              </Button>
            )}
          </div>
        )}

        {item.returnRequestStatus && (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-lg border-gray-300 sm:w-auto"
              onClick={() =>
                document.getElementById(sectionId)?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
            >
              Track return
            </Button>
            {item.refundStatus === "COMPLETED" && (
              <Button type="button" variant="ghost" className="w-full rounded-lg sm:w-auto">
                View refund ({formatCurrency(lineTotal)})
              </Button>
            )}
          </div>
        )}

        {item.returnResolutionType === "EXCHANGE" && item.returnRequestStatus && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-100 bg-violet-50/80 px-3 py-2 text-xs text-violet-900">
            <Package className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="font-semibold">Exchange in progress</span>
            <Badge variant="outline" className="border-violet-200 bg-white text-[10px] uppercase text-violet-800">
              Active
            </Badge>
            {item.replacementOrderItemId && (
              <span className="w-full text-[11px] text-violet-800/90">
                Your replacement appears as another product line on this order — use its Order tracking for shipment
                status.
              </span>
            )}
          </div>
        )}

        {item.returnRequestStatus === "REJECTED" && (
          <div className="rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm font-medium text-red-900">
            This return request was not approved. Contact support if you need help.
          </div>
        )}

        {showTimeline && (
          <div className="rounded-xl border border-gray-100 bg-gradient-to-b from-gray-50/90 to-white p-4">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {item.returnResolutionType === "EXCHANGE" ? "Exchange progress" : "Return progress"}
            </p>
            <ol className="relative space-y-0">
              {buildCustomerReturnTimeline(item, replacementLine).map((step, idx, arr) => {
                const isLast = idx === arr.length - 1
                return (
                  <li key={step.key} className="relative flex gap-3 pb-6 last:pb-0">
                    {!isLast && (
                      <span
                        className="absolute left-[15px] top-8 h-[calc(100%-8px)] w-px bg-gray-200"
                        aria-hidden
                      />
                    )}
                    <span className="relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-white shadow-sm">
                      {step.done ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
                      ) : step.current ? (
                        <Circle className="h-4 w-4 fill-blue-500 text-blue-500" aria-hidden />
                      ) : (
                        <Circle className="h-4 w-4 text-gray-300" aria-hidden />
                      )}
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          step.done && "text-emerald-800",
                          step.current && !step.done && "text-blue-700",
                          !step.done && !step.current && "text-gray-400",
                        )}
                      >
                        {step.label}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        )}

        {item.returnRequestStatus && (item.returnReason || (item.returnImages?.length ?? 0) > 0) && (
          <details
            open={!compact}
            className="group rounded-xl border border-orange-200/80 bg-orange-50/40 shadow-sm transition-all"
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 marker:content-none [&::-webkit-details-marker]:hidden">
              <Info className="h-4 w-4 shrink-0 text-orange-600" aria-hidden />
              Return request details
              <span className="ml-auto text-xs font-normal text-gray-500 group-open:hidden">
                Show
              </span>
              <span className="ml-auto hidden text-xs font-normal text-gray-500 group-open:inline">
                Hide
              </span>
            </summary>
            <div className="space-y-3 border-t border-orange-100 px-4 pb-4 pt-3">
              {item.returnReason && (
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <MessageCircle className="h-3.5 w-3.5 text-gray-400" aria-hidden />
                    Reason &amp; notes
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-gray-800">{item.returnReason}</p>
                </div>
              )}
              {(item.returnImages ?? []).length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Photos</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(item.returnImages ?? []).map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="block h-20 w-20 overflow-hidden rounded-lg border border-orange-100 bg-white shadow-sm transition-transform hover:scale-[1.02]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>
        )}

        {item.itemStatus === "DELIVERED" && !item.returnRequestStatus && item.returnAvailable && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
            <p className="text-sm font-semibold text-blue-900">Return policy</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-blue-950/90">
              {(item.returnPolicyDays ?? 0) > 0 && (
                <li>
                  {item.returnPolicyDays}-day return window from delivery
                  {daysLeft != null && daysLeft >= 0 ? ` (${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining)` : ""}
                  .
                </li>
              )}
              <li>Items must be in original condition with tags and packaging where applicable.</li>
              <li>Use &quot;{requestRefundLabel}&quot; to start a return or exchange.</li>
            </ul>
          </div>
        )}

        {item.refundStatus === "COMPLETED" && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
            <span className="font-medium">Refund received for this line.</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
