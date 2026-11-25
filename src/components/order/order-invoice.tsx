"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import QRCode from "qrcode"
import { formatCurrency, formatDate, formatSlotTimeRange } from "@/lib/utils"
import type {
  InvoiceData,
  InvoiceItem,
  InvoiceSeller,
  InvoiceQrPayload,
  InvoiceShippingAddressDetails,
} from "@/lib/invoice-types"
import { CheckCircle2, ExternalLink, MapPin, ShieldCheck, Truck } from "lucide-react"

export type {
  InvoiceData,
  InvoiceItem,
  InvoiceSeller,
  InvoiceQrPayload,
  InvoiceShippingAddressDetails,
}

interface OrderInvoiceProps {
  data: InvoiceData
  isLast?: boolean
}

export function OrderInvoice({ data, isLast }: OrderInvoiceProps) {
  const [fallbackQrUrl, setFallbackQrUrl] = useState<string>("")
  const qrTarget =
    data.qrVerifyUrl ||
    `Order: #${data.orderNumber} | Store: ${data.seller.storeName} | Total: ${formatCurrency(data.grandTotal)}`

  useEffect(() => {
    if (data.qrDataUrl) return
    let cancelled = false
    QRCode.toDataURL(qrTarget, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setFallbackQrUrl(url)
      })
      .catch(() => {
        /* ignore */
      })
    return () => {
      cancelled = true
    }
  }, [data.qrDataUrl, qrTarget])

  const qrSrc = data.qrDataUrl || fallbackQrUrl
  const verifyHref = data.qrToken
    ? `/invoice/verify?t=${encodeURIComponent(data.qrToken)}`
    : "/invoice/verify"

  const paymentLabel =
    data.paymentMethodLabel ||
    (data.paymentMethod === "FLOAT"
      ? "Float (Online / MoMo / Card)"
      : data.paymentMethod === "AFRIMONEY"
        ? "AfriMoney Mobile Money"
        : data.paymentMethod === "STRIPE"
          ? "Card (Stripe)"
          : "Cash on Delivery")

  const paymentBadgeClass =
    data.paymentStatus === "COMPLETED"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : data.paymentStatus === "FAILED"
        ? "bg-rose-50 text-rose-700 border-rose-200"
        : "bg-amber-50 text-amber-800 border-amber-200"

  return (
    <div
      className={`invoice-container bg-white w-full max-w-[210mm] print:w-[210mm] min-h-[275mm] mx-auto shadow-md rounded-2xl print:rounded-none border border-slate-200 print:shadow-none print:border-none overflow-hidden flex flex-col ${
        !isLast ? "print:break-after-page mb-8 print:mb-0" : ""
      }`}
    >
      {/* Top Dark Accent Strip */}
      <div className="h-2.5 w-full bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 print:bg-slate-900" />

      <div className="p-5 sm:p-8 print:p-6 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b-2 border-slate-900 pb-5 mb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center rounded-md bg-slate-900 px-2.5 py-1 text-xs font-black tracking-widest text-white">
                MEEEM
              </span>
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                Original for Recipient
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
              TAX INVOICE
            </h1>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 font-semibold text-slate-700 capitalize">
                <CheckCircle2 className="h-3 w-3 text-blue-600" />
                {String(data.orderStatus || "PENDING").toLowerCase().replace(/_/g, " ")}
              </span>
              {data.paymentStatus && (
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-bold uppercase tracking-wide text-[10px] ${paymentBadgeClass}`}
                >
                  Payment: {data.paymentStatus}
                </span>
              )}
            </div>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end gap-3 shrink-0">
            <div className="rounded-xl border border-slate-200 bg-white p-1.5 shadow-xs">
              {qrSrc ? (
                <img
                  src={qrSrc}
                  alt="Invoice Verification QR Code"
                  className="w-24 h-24 object-contain"
                />
              ) : (
                <div className="w-24 h-24 bg-slate-100 animate-pulse rounded" />
              )}
            </div>
            <div className="sm:text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center sm:justify-end gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-600" />
                Scan to Verify
              </p>
              <Link
                href={verifyHref}
                target="_blank"
                className="no-print mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline"
              >
                Verify online
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Invoice & Order Metadata Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm">
          <div className="space-y-1">
            <p className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">
              Invoice & Order Details
            </p>
            <p className="text-slate-800">
              <span className="font-bold text-slate-900">Invoice No:</span>{" "}
              <span className="font-mono font-semibold">{data.invoiceNumber || data.orderNumber}</span>
            </p>
            <p className="text-slate-800">
              <span className="font-bold text-slate-900">Order ID:</span>{" "}
              <span className="font-mono font-bold">#{data.orderNumber}</span>
            </p>
            <p className="text-slate-700">
              <span className="font-bold text-slate-900">Date:</span> {formatDate(data.date)}
            </p>
          </div>
          <div className="sm:text-right space-y-1">
            <p className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">
              Payment & Delivery Region
            </p>
            <p className="text-slate-800">
              <span className="font-bold text-slate-900">Payment:</span> {paymentLabel}
            </p>
            {(data.flotOrderId || data.afriTxnId) && (
              <p className="font-mono text-xs text-slate-500">
                Ref: {data.flotOrderId || data.afriTxnId}
              </p>
            )}
            {data.paidAt && (
              <p className="text-xs text-slate-500">Paid on {formatDate(data.paidAt)}</p>
            )}
            <div className="pt-1 flex sm:justify-end">
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                <MapPin className="h-3 w-3 text-emerald-600" />
                {data.deliveryZoneLabel || "Standard Zone"}
              </span>
            </div>
          </div>
        </div>

        {/* Sold By / Shipping To Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-7 text-sm">
          <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/40">
            <p className="font-bold text-slate-400 uppercase text-[10px] tracking-widest mb-2">
              Sold By
            </p>
            <h2 className="font-black text-slate-900 text-base">{data.seller.storeName}</h2>
            {data.seller.businessName && data.seller.businessName !== data.seller.storeName && (
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                Legal Entity: {data.seller.businessName}
              </p>
            )}
            <p className="text-slate-600 leading-relaxed mt-1.5 whitespace-pre-wrap text-xs sm:text-sm">
              {data.seller.address}
            </p>
            <div className="mt-3 space-y-0.5 text-xs text-slate-700">
              <p>
                <span className="font-bold">Phone:</span> {data.seller.phone}
              </p>
              {data.seller.gstin && (
                <p>
                  <span className="font-bold">GSTIN / TIN:</span> {data.seller.gstin}
                </p>
              )}
              {data.seller.regNumber && (
                <p>
                  <span className="font-bold">Reg No:</span> {data.seller.regNumber}
                </p>
              )}
              {data.seller.pan && (
                <p>
                  <span className="font-bold">PAN:</span> {data.seller.pan}
                </p>
              )}
            </div>
          </div>

          <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/40">
            <p className="font-bold text-slate-400 uppercase text-[10px] tracking-widest mb-2">
              Shipping / Billing To
            </p>
            <h2 className="font-black text-slate-900 text-base">{data.customerName}</h2>
            <p className="text-slate-600 leading-relaxed mt-1.5 whitespace-pre-wrap text-xs sm:text-sm">
              {data.shippingAddress}
            </p>
            <div className="mt-3 space-y-1 text-xs text-slate-700">
              <p>
                <span className="font-bold">Phone:</span> {data.customerPhone}
              </p>
              {data.customerEmail && (
                <p>
                  <span className="font-bold">Email:</span> {data.customerEmail}
                </p>
              )}
              <p className="font-semibold text-emerald-700 pt-0.5">
                Delivery Zone: {data.deliveryZoneLabel || "Standard Zone"}
              </p>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-8 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[540px] text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] uppercase tracking-widest">
                <th className="py-3.5 px-4 font-bold w-10">#</th>
                <th className="py-3.5 px-4 font-bold">Item Description</th>
                <th className="py-3.5 px-4 font-bold text-center">Qty</th>
                <th className="py-3.5 px-4 font-bold text-right">Unit Price</th>
                <th className="py-3.5 px-4 font-bold text-right">GST</th>
                <th className="py-3.5 px-4 font-bold text-right">Net Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.items.map((item, idx) => (
                <tr key={item.id} className="odd:bg-white even:bg-slate-50/50">
                  <td className="py-3.5 px-4 text-xs text-slate-400 font-mono align-top">
                    {idx + 1}
                  </td>
                  <td className="py-3.5 px-4 align-top">
                    <p className="font-semibold text-slate-900">
                      {item.productName}
                      {item.isExchangeReplacement && (
                        <span className="ml-2 inline-block rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                          Exchange Replacement
                        </span>
                      )}
                    </p>
                    {item.sku && (
                      <p className="text-[11px] font-mono text-slate-500 mt-0.5">SKU: {item.sku}</p>
                    )}
                    {item.serviceSlotStartTime && item.serviceSlotEndTime && (
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Slot: {formatSlotTimeRange(item.serviceSlotStartTime, item.serviceSlotEndTime)}
                      </p>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center tabular-nums align-top">
                    {item.quantity}
                  </td>
                  <td className="py-3.5 px-4 text-right tabular-nums align-top">
                    {formatCurrency(item.price)}
                  </td>
                  <td className="py-3.5 px-4 text-right tabular-nums text-emerald-700 align-top">
                    {formatCurrency(item.gstAmount)}
                  </td>
                  <td className="py-3.5 px-4 text-right tabular-nums font-bold text-slate-900 align-top">
                    {formatCurrency(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary & Delivery Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start mb-10">
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 space-y-2 text-xs text-slate-700">
            <p className="font-bold text-emerald-900 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-emerald-700" />
              Delivery & Region Information
            </p>
            <div className="flex justify-between gap-2">
              <span className="text-slate-600">Delivery Region:</span>
              <span className="font-bold text-slate-900">{data.deliveryRegion}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-600">Delivery Zone:</span>
              <span className="font-bold text-emerald-800">{data.deliveryZoneLabel}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-600">Delivery Charge:</span>
              <span className="font-bold text-slate-900">
                {data.isServiceOnly && data.shippingCharge <= 0
                  ? "N/A (Service)"
                  : data.shippingCharge <= 0
                    ? "FREE"
                    : formatCurrency(data.shippingCharge)}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-600">Fulfillment:</span>
              <span className="font-semibold text-slate-800">
                {data.isServiceOnly
                  ? "Service Appointment"
                  : data.seller.isSelfDelivery
                    ? "Merchant Self-Delivery"
                    : "MEEEM Delivery Partner"}
              </span>
            </div>
          </div>

          <div className="w-full sm:max-w-[320px] sm:ml-auto space-y-2.5 bg-slate-50 p-5 rounded-2xl border border-slate-200">
            <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>Item Subtotal</span>
              <span className="text-slate-900 tabular-nums">{formatCurrency(data.subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs font-bold text-emerald-700 uppercase tracking-wider">
              <span>Total GST</span>
              <span className="tabular-nums">+{formatCurrency(data.gstTotal)}</span>
            </div>
            <div className="flex justify-between text-xs font-bold text-slate-800 bg-slate-200/70 px-2.5 py-1.5 rounded-lg">
              <span>Item Gross (Tax-Incl.)</span>
              <span className="tabular-nums">
                {formatCurrency(data.itemGrossTotal ?? data.subtotal + data.gstTotal)}
              </span>
            </div>
            {(!data.isServiceOnly || data.shippingCharge > 0) && (
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                <span className="text-slate-600">Delivery Charge</span>
                <span
                  className={
                    data.shippingCharge <= 0
                      ? "text-emerald-700 font-extrabold"
                      : "text-orange-600 tabular-nums"
                  }
                >
                  {data.shippingCharge <= 0 ? "FREE" : `+${formatCurrency(data.shippingCharge)}`}
                </span>
              </div>
            )}
            {data.couponDiscount && data.couponDiscount > 0 ? (
              <div className="flex justify-between text-xs font-bold text-emerald-700 uppercase tracking-wider">
                <span>Coupon Discount {data.couponCode ? `(${data.couponCode})` : ""}</span>
                <span className="tabular-nums">-{formatCurrency(data.couponDiscount)}</span>
              </div>
            ) : null}
            {data.exchangeTopUpAmount && data.exchangeTopUpAmount > 0 ? (
              <div className="flex justify-between text-xs font-bold text-amber-700 uppercase tracking-wider">
                <span>Exchange Top-up</span>
                <span className="tabular-nums">+{formatCurrency(data.exchangeTopUpAmount)}</span>
              </div>
            ) : null}
            <div className="pt-3 border-t-2 border-dashed border-slate-300">
              <div className="flex justify-between items-center">
                <span className="text-sm font-black text-slate-900 uppercase">Grand Total</span>
                <span className="text-xl font-black text-slate-900 tabular-nums">
                  {formatCurrency(data.grandTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer / Declarations */}
        <div className="border-t border-slate-200 pt-6 mt-auto text-[11px] text-slate-500 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="font-bold text-slate-900 uppercase tracking-wider mb-1.5">
                Declaration
              </p>
              <p className="italic leading-relaxed">
                We declare that this invoice shows the actual price of the goods or services described
                and that all particulars are true and correct. This is a computer-generated invoice
                verifiable via QR code and does not require a physical signature.
              </p>
            </div>
            <div className="sm:text-right flex flex-col sm:items-end justify-end">
              <div className="h-12 w-40 border-b border-slate-300 mb-1" />
              <p className="font-bold text-slate-900 uppercase tracking-wider">
                Authorized Signatory
              </p>
              <p className="text-[10px] mt-0.5 text-slate-400">For {data.seller.storeName}</p>
            </div>
          </div>

          <div className="pt-5 border-t border-slate-100 flex flex-wrap justify-between items-center gap-2 text-[10px]">
            <p>© 2026 MEEEM PLATFORM. All rights reserved.</p>
            <p className="font-mono text-slate-400">
              {data.invoiceNumber} • REF-{data.orderNumber}
            </p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @page {
          size: A4;
          margin: 10mm;
        }
        @media print {
          body {
            background: #ffffff !important;
          }
          .no-print {
            display: none !important;
          }
          .invoice-container {
            position: static !important;
            margin: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            width: 100% !important;
            max-width: 100% !important;
          }
        }
      `}</style>
    </div>
  )
}
