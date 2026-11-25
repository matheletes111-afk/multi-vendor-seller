"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { OrderInvoice, InvoiceData } from "./order-invoice"
import { Button } from "@/ui/button"
import { Loader2, Printer, ArrowLeft, Download, QrCode } from "lucide-react"

interface OrderInvoicePageClientProps {
  orderId: string
  sellerId?: string
  backUrl: string
}

export function OrderInvoicePageClient({ orderId, sellerId, backUrl }: OrderInvoicePageClientProps) {
  const [invoices, setInvoices] = useState<InvoiceData[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  useEffect(() => {
    const url = `/api/orders/${orderId}/invoice${sellerId ? `?sellerId=${encodeURIComponent(sellerId)}` : ""}`
    fetch(url, { credentials: "include" })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => { throw new Error(d.error || "Failed to fetch invoice") })
        return res.json()
      })
      .then((data) => setInvoices(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [orderId, sellerId])

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPdf = async () => {
    if (!invoices || invoices.length === 0 || downloadingPdf) return
    setDownloadError(null)
    setDownloadingPdf(true)
    try {
      const pdfUrl = `/api/orders/${orderId}/invoice/pdf${sellerId ? `?sellerId=${encodeURIComponent(sellerId)}` : ""}`
      const res = await fetch(pdfUrl, { credentials: "include" })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson?.error || "Failed to download PDF")
      }
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = objectUrl
      a.download = `MEEEM-Invoice-${invoices[0].orderNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Failed to download PDF")
    } finally {
      setDownloadingPdf(false)
    }
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
          <Button onClick={() => (window.location.href = backUrl)} variant="outline" className="w-full rounded-xl">
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  const verifyHref = invoices[0]?.qrToken
    ? `/invoice/verify?t=${encodeURIComponent(invoices[0].qrToken)}`
    : "/invoice/verify"

  return (
    <div className="min-h-screen bg-slate-100/70 pb-20 print:bg-white print:p-0">
      {/* Action Header - Hidden on Print */}
      <div className="no-print sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (window.location.href = backUrl)}
            className="rounded-xl"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </Button>
          <div>
            <h1 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-widest leading-none">
              Invoice #{invoices[0].orderNumber}
            </h1>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              {invoices.length} Merchant{invoices.length > 1 ? "s" : ""} Included •{" "}
              {invoices[0].deliveryZoneLabel}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild className="rounded-xl border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100">
            <Link href={verifyHref} target="_blank">
              <QrCode className="w-4 h-4 mr-1.5" />
              Verify QR
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="rounded-xl border-slate-300"
          >
            <Printer className="w-4 h-4 mr-1.5" />
            Print
          </Button>
          <Button
            size="sm"
            onClick={() => void handleDownloadPdf()}
            disabled={downloadingPdf}
            className="rounded-xl bg-slate-900 hover:bg-slate-800 shadow-md"
          >
            {downloadingPdf ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-1.5" />
            )}
            {downloadingPdf ? "Preparing PDF..." : "Download A4 PDF"}
          </Button>
        </div>
      </div>

      {downloadError && (
        <div className="no-print max-w-[210mm] mx-auto mt-4 px-4">
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">
            {downloadError}
          </p>
        </div>
      )}

      {/* Invoice Rendering Area */}
      <div className="max-w-[210mm] mx-auto mt-6 sm:mt-8 px-3 sm:px-0 print:px-0 print:mt-0">
        {invoices.map((inv, idx) => (
          <OrderInvoice
            key={`${inv.invoiceNumber}-${inv.seller.storeName}`}
            data={inv}
            isLast={idx === invoices.length - 1}
          />
        ))}
      </div>

      {/* Floating Info for Users - Hidden on Print */}
      <div className="no-print fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur text-white px-5 py-2.5 rounded-full shadow-2xl hidden sm:flex items-center gap-3 border border-white/10">
        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
        <span className="text-xs font-bold uppercase tracking-widest whitespace-nowrap">
          A4 PDF & QR Verification Ready
        </span>
      </div>
    </div>
  )
}
