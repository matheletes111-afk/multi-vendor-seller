"use client"

import { useState, useEffect } from "react"
import { History, Tag, CheckCircle2, Calendar, CreditCard, Loader2, Eye } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { PlanSnapshotModal } from "@/components/subscription/plan-snapshot-modal"

export type SubscriptionHistoryItem = {
  id: string
  planName: string
  planType: string
  price: number
  paidPrice?: number | null
  planSnapshot?: any | null
  status: string
  periodStart?: string | Date | null
  periodEnd?: string | Date | null
  createdAt: string | Date
  couponCode?: string | null
  couponDiscount: number
  finalPaidAmount: number
  isCurrent?: boolean
}

export function SellerSubscriptionHistoryTable() {
  const [history, setHistory] = useState<SubscriptionHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSubForSnapshot, setSelectedSubForSnapshot] = useState<SubscriptionHistoryItem | null>(null)

  useEffect(() => {
    fetch("/api/seller/subscription/history")
      .then((res) => (res.ok ? res.json() : { history: [] }))
      .then((data) => setHistory(data.history || []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
        <span>Loading subscription history...</span>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <History className="h-12 w-12 mx-auto text-slate-300 mb-3" />
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Subscription History</h3>
        <p className="text-xs text-slate-400 mt-1">Your past subscription purchases and coupon redemptions will appear here.</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="h-5 w-5 text-indigo-600" />
            Subscription History & Purchases
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">View your past subscription activations, plan renewals, and applied coupon codes.</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="px-6 py-4">Plan / Details</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Price</th>
              <th className="px-6 py-4">Applied Coupon</th>
              <th className="px-6 py-4">Paid Amount</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {history.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                    <span>{item.planName}</span>
                    {item.isCurrent && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        Current Plan
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    item.status === "ACTIVE"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                      : item.status === "COMPLETED"
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  }`}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {item.status}
                  </span>
                </td>
                <td className="px-6 py-4 font-medium text-slate-600 dark:text-slate-300">
                  {formatCurrency(Number(item.price || 0))}
                </td>
                <td className="px-6 py-4">
                  {item.couponCode ? (
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      <Tag className="h-3 w-3 text-purple-600" />
                      {item.couponCode} (-{formatCurrency(Number(item.couponDiscount || 0))})
                    </div>
                  ) : (
                    <span className="text-slate-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-6 py-4 font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(Number(item.finalPaidAmount || 0))}
                </td>
                <td className="px-6 py-4 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  {item.planSnapshot || item.planType !== "COUPON_REDEMPTION" ? (
                    <button
                      onClick={() => setSelectedSubForSnapshot(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-xl transition-all border border-indigo-200 dark:border-indigo-800/60 shadow-sm"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>View Plan</span>
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400 font-medium">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PlanSnapshotModal
        isOpen={!!selectedSubForSnapshot}
        onClose={() => setSelectedSubForSnapshot(null)}
        subscription={selectedSubForSnapshot}
      />
    </div>
  )
}

