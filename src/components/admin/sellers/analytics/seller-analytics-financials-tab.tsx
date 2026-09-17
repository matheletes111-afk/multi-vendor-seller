"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { formatCurrency } from "@/lib/utils"
import {
  DollarSign,
  Percent,
  CreditCard,
  TrendingUp,
  Wallet,
  Building2,
  Receipt,
  Scale,
  CheckCircle2,
} from "lucide-react"
import type { SellerAnalyticsPayload } from "@/app/api/admin/sellers/[id]/analytics/route"

interface SellerAnalyticsFinancialsTabProps {
  data: SellerAnalyticsPayload
}

export function SellerAnalyticsFinancialsTab({ data }: SellerAnalyticsFinancialsTabProps) {
  const { kpis, seller, paymentMethods } = data

  const commissionPercent = seller.commissionRate ?? 10
  const netMarginPercent = kpis.grossRevenue > 0
    ? Math.round((kpis.netEarnings / kpis.grossRevenue) * 100)
    : 100 - commissionPercent

  return (
    <div className="space-y-6">
      {/* 3 Core Metric Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Gross Revenue */}
        <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />
          <CardHeader className="p-6 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Gross Sales Volume
              </CardTitle>
              <div className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="pt-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 font-mono">
                {formatCurrency(kpis.grossRevenue)}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0 text-xs text-slate-500">
            Total transaction revenue generated across all completed orders
          </CardContent>
        </Card>

        {/* Platform Commission */}
        <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-600" />
          <CardHeader className="p-6 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Platform Commission
              </CardTitle>
              <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 text-[10px] font-bold">
                {commissionPercent}% Rate
              </Badge>
            </div>
            <div className="pt-2">
              <span className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 font-mono">
                {formatCurrency(kpis.commissionTotal)}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0 text-xs text-slate-500">
            Total marketplace commission fee retained by MEEEM platform
          </CardContent>
        </Card>

        {/* Net Seller Payout */}
        <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-600" />
          <CardHeader className="p-6 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Net Seller Earnings
              </CardTitle>
              <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 text-[10px] font-bold">
                {netMarginPercent}% Payout
              </Badge>
            </div>
            <div className="pt-2">
              <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {formatCurrency(kpis.netEarnings)}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0 text-xs text-slate-500">
            Total net revenue attributable and payable to this partner
          </CardContent>
        </Card>
      </div>

      {/* Secondary Financial Metrics & Payment Methods */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Commission & Settlement Analysis */}
        <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <CardHeader className="p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Scale className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Settlement & Average Order Value
            </CardTitle>
            <CardDescription className="text-xs">
              Transaction efficiency and payout structure
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-xs text-slate-500 font-medium block">Average Order Value (AOV)</span>
                <span className="text-base font-bold font-mono text-slate-900 dark:text-slate-100">
                  {formatCurrency(kpis.averageOrderValue)}
                </span>
              </div>
              <TrendingUp className="h-5 w-5 text-indigo-500" />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-xs text-slate-500 font-medium block">Assigned Commission Tier</span>
                <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {commissionPercent}% Override
                </span>
              </div>
              <Percent className="h-5 w-5 text-amber-500" />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-xs text-slate-500 font-medium block">Order Completion Rate</span>
                <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                  {kpis.completionRate}%
                </span>
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        {/* Payment Channels */}
        <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <CardHeader className="p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Payment Methods Breakdown
            </CardTitle>
            <CardDescription className="text-xs">
              Customer settlement channels used for this partner
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {paymentMethods.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No payment method records available.</p>
            ) : (
              paymentMethods.map((pm) => {
                const percent = kpis.grossRevenue > 0
                  ? Math.round((pm.revenue / kpis.grossRevenue) * 100)
                  : 0

                return (
                  <div key={pm.method} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {pm.method}
                      </span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(pm.revenue)}
                        </span>
                        <span className="text-slate-400 text-[11px]">({pm.count} txns, {percent}%)</span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${Math.max(5, percent)}%` }}
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-300"
                      />
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
