"use client"

import React from "react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Separator } from "@/ui/separator"

export interface InvoiceItem {
  id: string
  productName: string
  quantity: number
  price: number
  gstAmount: number
  total: number
}

export interface InvoiceSeller {
  storeName: string
  address: string
  phone: string
  gstin?: string
  pan?: string
}

export interface InvoiceData {
  orderNumber: string
  date: string
  customerName: string
  customerPhone: string
  shippingAddress: string
  seller: InvoiceSeller
  items: InvoiceItem[]
  subtotal: number
  gstTotal: number
  shippingCharge: number
  grandTotal: number
  couponCode?: string | null
  couponDiscount?: number
}

interface OrderInvoiceProps {
  data: InvoiceData
  isLast?: boolean
}

export function OrderInvoice({ data, isLast }: OrderInvoiceProps) {
  const itemSummaries = data.items.map(it => `${it.productName} (x${it.quantity})`).join(", ")
  const qrData = `Order: #${data.orderNumber} | Store: ${data.seller.storeName} | Customer: ${data.customerName} | Items: ${itemSummaries} | Total: ${formatCurrency(data.grandTotal)}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`

  return (
    <div className={`invoice-container bg-white p-8 mx-auto shadow-sm border border-slate-200 print:shadow-none print:border-none print:p-0 ${!isLast ? 'print:break-after-page mb-8 print:mb-0' : ''}`} style={{ width: '210mm', minHeight: '290mm' }}>
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-slate-900">TAX INVOICE</h1>
          <p className="text-sm font-bold text-slate-500 mt-1 uppercase tracking-widest">Original for Recipient</p>
        </div>
        <div className="text-right">
          <img src={qrUrl} alt="QR Code" className="w-24 h-24 inline-block border border-slate-100 p-1" />
          <p className="text-[8px] font-mono mt-1 text-slate-400">Scan to Verify</p>
        </div>
      </div>

      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
        <div className="space-y-1">
          <p className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Invoice Details</p>
          <p><span className="font-bold">Invoice No:</span> {data.orderNumber}</p>
          <p><span className="font-bold">Date:</span> {formatDate(data.date)}</p>
        </div>
        <div className="text-right space-y-1">
          <p className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Order ID</p>
          <p className="font-mono text-lg font-bold">#{data.orderNumber}</p>
        </div>
      </div>

      {/* Address Grid */}
      <div className="grid grid-cols-2 gap-8 mb-10 text-sm">
        <div className="p-4 border rounded-xl bg-slate-50/50">
          <p className="font-bold text-slate-400 uppercase text-[10px] tracking-widest mb-2">Sold By</p>
          <h2 className="font-black text-slate-900 text-base">{data.seller.storeName}</h2>
          <p className="text-slate-600 leading-relaxed mt-1 whitespace-pre-wrap">{data.seller.address}</p>
          <div className="mt-3 space-y-0.5 text-[12px]">
            {data.seller.gstin && <p><span className="font-bold">GSTIN:</span> {data.seller.gstin}</p>}
            {data.seller.pan && <p><span className="font-bold">PAN:</span> {data.seller.pan}</p>}
            <p><span className="font-bold">Phone:</span> {data.seller.phone}</p>
          </div>
        </div>
        <div className="p-4 border rounded-xl bg-slate-50/50">
          <p className="font-bold text-slate-400 uppercase text-[10px] tracking-widest mb-2">Shipping To</p>
          <h2 className="font-black text-slate-900 text-base">{data.customerName}</h2>
          <p className="text-slate-600 leading-relaxed mt-1 whitespace-pre-wrap">{data.shippingAddress}</p>
          <div className="mt-3 text-[12px]">
            <p><span className="font-bold">Phone:</span> {data.customerPhone}</p>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-10 overflow-hidden rounded-xl border">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white text-[10px] uppercase tracking-widest">
              <th className="p-4 font-bold">Item Description</th>
              <th className="p-4 font-bold text-center">Qty</th>
              <th className="p-4 font-bold text-right">Unit Price</th>
              <th className="p-4 font-bold text-right">GST</th>
              <th className="p-4 font-bold text-right">Net Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.items.map((item, idx) => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 font-medium text-slate-900">{item.productName}</td>
                <td className="p-4 text-center tabular-nums">{item.quantity}</td>
                <td className="p-4 text-right tabular-nums">{formatCurrency(item.price)}</td>
                <td className="p-4 text-right tabular-nums text-emerald-600">{formatCurrency(item.gstAmount)}</td>
                <td className="p-4 text-right tabular-nums font-bold text-slate-900">{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary calculation */}
      <div className="flex justify-end mb-12">
        <div className="w-full max-w-[300px] space-y-3 bg-slate-50 p-6 rounded-2xl border">
          <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
            <span>Subtotal</span>
            <span className="text-slate-900">{formatCurrency(data.subtotal)}</span>
          </div>
          <div className="flex justify-between text-xs font-bold text-emerald-600 uppercase tracking-widest">
            <span>Total GST</span>
            <span>{formatCurrency(data.gstTotal)}</span>
          </div>
          {data.shippingCharge > 0 && (
            <div className="flex justify-between text-xs font-bold text-orange-600 uppercase tracking-widest">
              <span>Shipping</span>
              <span>{formatCurrency(data.shippingCharge)}</span>
            </div>
          )}
          {data.couponDiscount && data.couponDiscount > 0 ? (
            <div className="flex justify-between text-xs font-bold text-emerald-600 uppercase tracking-widest">
              <span>Coupon Discount {data.couponCode ? `(${data.couponCode})` : ""}</span>
              <span>-{formatCurrency(data.couponDiscount)}</span>
            </div>
          ) : null}
          <div className="pt-3 border-t-2 border-dashed border-slate-300">
            <div className="flex justify-between items-center">
              <span className="text-sm font-black text-slate-900 uppercase">Grand Total</span>
              <span className="text-xl font-black text-slate-900">{formatCurrency(data.grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer / Declarations */}
      <div className="border-t pt-8 mt-auto text-[10px] text-slate-500 space-y-6">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="font-bold text-slate-900 uppercase tracking-wider mb-2">Declaration</p>
            <p className="italic leading-relaxed">
              We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
              This is a computer generated invoice and does not require a physical signature.
            </p>
          </div>
          <div className="text-right flex flex-col items-end justify-end">
            <div className="h-16 w-40 border-b border-slate-300 mb-1"></div>
            <p className="font-bold text-slate-900 uppercase tracking-wider">Authorized Signatory</p>
            <p className="text-[8px] mt-0.5 opacity-50">For {data.seller.storeName}</p>
          </div>
        </div>
        
        <div className="text-center pt-8 border-t border-slate-100 flex justify-between items-center">
          <p>© 2026 MEEEM PLATFORM. All rights reserved.</p>
          <p className="font-mono opacity-50 tracking-tighter">INV-REF-{data.orderNumber}-XPRO</p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .invoice-container, .invoice-container * {
            visibility: visible;
          }
          .invoice-container {
            position: absolute;
            left: 0;
            top: 0;
            margin: 0 !important;
            padding: 0 !important;
            border: none;
            box-shadow: none;
            width: 100% !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}
