"use client"

import { useEffect, useState } from "react"
import { OrderInvoice, InvoiceData } from "./order-invoice"
import { Button } from "@/ui/button"
import { Loader2, Printer, ArrowLeft, Download } from "lucide-react"

interface OrderInvoicePageClientProps {
  orderId: string
  sellerId?: string
  backUrl: string
}

export function OrderInvoicePageClient({ orderId, sellerId, backUrl }: OrderInvoicePageClientProps) {
  const [invoices, setInvoices] = useState<InvoiceData[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const url = `/api/orders/${orderId}/invoice${sellerId ? `?sellerId=${sellerId}` : ""}`
    fetch(url)
      .then((res) => {
        if (!res.ok) return res.json().then(d => { throw new Error(d.error || "Failed to fetch invoice") })
        return res.json()
      })
      .then((data) => setInvoices(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [orderId, sellerId])

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary mb-4" />
          <p className="text-slate-500 font-medium">Generating your invoice...</p>
        </div>
      </div>
    )
  }

  if (error || !invoices || invoices.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl text-center border">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <ArrowLeft className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Invoice Not Found</h2>
          <p className="text-slate-500 mb-6">{error || "The requested invoice could not be generated."}</p>
          <Button onClick={() => window.location.href = backUrl} variant="outline" className="w-full rounded-xl">
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100/50 pb-20 print:bg-white print:p-0">
      {/* Action Header - Hidden on Print */}
      <div className="no-print sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => window.location.href = backUrl} className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-sm font-bold text-slate-900 uppercase tracking-widest leading-none">
              Invoices for Order #{invoices[0].orderNumber}
            </h1>
            <p className="text-[10px] text-slate-500 font-medium mt-1 uppercase tracking-tighter">
              {invoices.length} Merchant{invoices.length > 1 ? 's' : ''} Included
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handlePrint} className="rounded-xl bg-slate-900 hover:bg-slate-800 shadow-lg shadow-slate-200">
            <Printer className="w-4 h-4 mr-2" />
            Download A4 PDF
          </Button>
        </div>
      </div>

      {/* Invoice Rendering Area */}
      <div className="max-w-[210mm] mx-auto mt-8 print:mt-0 transition-all duration-700 animate-in fade-in slide-in-from-bottom-4">
        {invoices.map((inv, idx) => (
          <OrderInvoice 
            key={`${inv.orderNumber}-${inv.seller.storeName}`} 
            data={inv} 
            isLast={idx === invoices.length - 1} 
          />
        ))}
      </div>

      {/* Floating Info for Users - Hidden on Print */}
      <div className="no-print fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-white/10">
        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
        <span className="text-xs font-bold uppercase tracking-widest whitespace-nowrap">
          Ready for A4 Printing
        </span>
      </div>
    </div>
  )
}
