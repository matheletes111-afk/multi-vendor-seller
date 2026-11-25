"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import jsQR from "jsqr"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { Input } from "@/ui/input"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { InvoiceData } from "@/lib/invoice-types"
import {
  Camera,
  CheckCircle2,
  Download,
  Loader2,
  MapPin,
  QrCode,
  Search,
  ShieldAlert,
  ShieldCheck,
  Store,
  Truck,
  Upload,
  X,
} from "lucide-react"

export interface VerifyResponseData {
  success: boolean
  verified: boolean
  verificationMode: "SIGNED_TOKEN" | "AUTHENTICATED_LOOKUP"
  isPublicMasked: boolean
  orderId: string
  orderNumber: string
  invoiceCount: number
  invoice: InvoiceData
  invoices: InvoiceData[]
}

export function InvoiceVerifyClient({
  initialInput,
  initialResult,
  initialError,
}: {
  initialInput: string
  initialResult: VerifyResponseData | null
  initialError: string | null
}) {
  const [qrInput, setQrInput] = useState(initialInput)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [result, setResult] = useState<VerifyResponseData | null>(initialResult)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)

  const stopCamera = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraOpen(false)
  }, [])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  const verifyCode = useCallback(async (raw: string) => {
    const clean = raw.trim()
    if (!clean) {
      setError("Please scan a QR code or paste an invoice token / verification URL.")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/orders/invoice/verify-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ qrData: clean }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.verified) {
        throw new Error(json?.error || "Could not verify invoice QR code")
      }
      setResult(json as VerifyResponseData)
    } catch (err) {
      setResult(null)
      setError(err instanceof Error ? err.message : "Failed to verify QR code")
    } finally {
      setLoading(false)
    }
  }, [])

  const startCamera = async () => {
    setCameraError(null)
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is not supported in this browser. Please upload a QR image or paste the verification code.")
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })
      streamRef.current = stream
      setCameraOpen(true)

      setTimeout(() => {
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        void video.play()

        const scanFrame = () => {
          if (!videoRef.current || !streamRef.current) return
          const v = videoRef.current
          if (v.readyState === v.HAVE_ENOUGH_DATA && v.videoWidth > 0 && v.videoHeight > 0) {
            const canvas = canvasRef.current || document.createElement("canvas")
            canvasRef.current = canvas
            canvas.width = v.videoWidth
            canvas.height = v.videoHeight
            const ctx = canvas.getContext("2d", { willReadFrequently: true })
            if (ctx) {
              ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
              const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "attemptBoth",
              })
              if (code?.data) {
                stopCamera()
                setQrInput(code.data)
                void verifyCode(code.data)
                return
              }
            }
          }
          rafRef.current = requestAnimationFrame(scanFrame)
        }
        rafRef.current = requestAnimationFrame(scanFrame)
      }, 80)
    } catch (err) {
      setCameraError(
        err instanceof Error
          ? `Camera permission denied or unavailable: ${err.message}`
          : "Unable to open camera"
      )
      stopCamera()
    }
  }

  const handleImageUpload = (file: File) => {
    setError(null)
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext("2d")
        if (!ctx) throw new Error("Canvas unavailable")
        ctx.drawImage(img, 0, 0)
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const decoded = jsQR(imgData.data, imgData.width, imgData.height, {
          inversionAttempts: "attemptBoth",
        })
        if (!decoded?.data) {
          setError("No readable QR code was detected in that image. Try a clearer crop.")
          return
        }
        setQrInput(decoded.data)
        void verifyCode(decoded.data)
      } catch {
        setError("Failed to read QR code from uploaded image.")
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      setError("Invalid image file.")
    }
    img.src = objectUrl
  }

  const handleDownloadPdf = async (orderId: string, orderNumber: string, sellerId?: string | null) => {
    if (downloadingPdf) return
    setDownloadingPdf(true)
    try {
      const url = `/api/orders/${orderId}/invoice/pdf${sellerId ? `?sellerId=${encodeURIComponent(sellerId)}` : ""}`
      const res = await fetch(url, { credentials: "include" })
      if (!res.ok) throw new Error("Failed to download PDF")
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = objectUrl
      a.download = `MEEEM-Invoice-${orderNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download PDF")
    } finally {
      setDownloadingPdf(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80 py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Banner */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-bold text-emerald-800">
            <QrCode className="h-3.5 w-3.5 text-emerald-600" />
            MEEEM Invoice QR Scanner & Verifier
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Verify Tax Invoice Authenticity
          </h1>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            Scan any MEEEM invoice QR code using your camera, upload a QR image, or paste the verification link/token to view live verified order, delivery, and region data.
          </p>
        </div>

        {/* Scanner / Input Card */}
        <Card className="border-slate-200 shadow-sm bg-white rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Search className="h-4 w-4 text-blue-600" />
              Scan or Enter QR Code
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void verifyCode(qrInput)
              }}
              className="flex flex-col sm:flex-row gap-2.5"
            >
              <Input
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                placeholder="Paste QR URL, M1... token, or Order # (when signed in)"
                className="h-11 rounded-xl font-mono text-xs sm:text-sm"
              />
              <Button
                type="submit"
                disabled={loading}
                className="h-11 rounded-xl px-6 bg-slate-900 hover:bg-slate-800 shrink-0"
              >
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                Verify Invoice
              </Button>
            </form>

            <div className="flex flex-wrap items-center gap-3">
              {!cameraOpen ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void startCamera()}
                  className="rounded-xl border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Scan with Camera
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={stopCamera}
                  className="rounded-xl border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                >
                  <X className="h-4 w-4 mr-2" />
                  Stop Camera
                </Button>
              )}

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50">
                <Upload className="h-4 w-4 text-slate-500" />
                Upload QR Image
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ""
                    if (file) handleImageUpload(file)
                  }}
                />
              </label>
            </div>

            {cameraError && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-900">
                {cameraError}
              </p>
            )}

            {cameraOpen && (
              <div className="relative overflow-hidden rounded-2xl border-2 border-blue-500 bg-black max-w-md mx-auto">
                <video ref={videoRef} playsInline muted className="w-full h-64 object-cover" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-44 w-44 rounded-2xl border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                </div>
                <p className="bg-slate-900/90 py-2 text-center text-xs font-medium text-white">
                  Point your camera at the invoice QR code
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <Card className="border-rose-200 bg-rose-50/90 rounded-2xl">
            <CardContent className="p-4 flex items-start gap-3 text-rose-900">
              <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold">Verification Failed</p>
                <p className="text-rose-700 mt-0.5">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Verified Invoice Result */}
        {result && result.verified && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-black text-emerald-950 uppercase tracking-wide">
                    Verified Authentic MEEEM Invoice
                  </p>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Order #{result.orderNumber} • Verified via{" "}
                    {result.verificationMode === "SIGNED_TOKEN"
                      ? "Cryptographic QR Signature"
                      : "Authenticated Order Lookup"}
                  </p>
                  {result.isPublicMasked && (
                    <p className="text-[11px] text-emerald-700 mt-1">
                      Showing privacy-protected public details. Sign in as the customer or merchant for full contact & street address.
                    </p>
                  )}
                </div>
              </div>
              {!result.isPublicMasked && (
                <Button
                  type="button"
                  size="sm"
                  disabled={downloadingPdf}
                  onClick={() => void handleDownloadPdf(result.orderId, result.orderNumber)}
                  className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white"
                >
                  {downloadingPdf ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-1.5" />
                  )}
                  Download A4 PDF
                </Button>
              )}
            </div>

            {result.invoices.map((inv) => (
              <Card key={inv.invoiceNumber} className="border-slate-200 bg-white shadow-md rounded-2xl overflow-hidden">
                <CardHeader className="bg-slate-900 text-white py-4 px-5 flex flex-row flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                      {inv.invoiceNumber}
                    </p>
                    <CardTitle className="text-lg font-black">
                      Order #{inv.orderNumber}
                    </CardTitle>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-white/10 text-white border-white/20 capitalize">
                      {String(inv.orderStatus).toLowerCase().replace(/_/g, " ")}
                    </Badge>
                    {inv.paymentStatus && (
                      <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30">
                        {inv.paymentStatus}
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-5 space-y-5 text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <Store className="h-3.5 w-3.5" /> Merchant
                      </p>
                      <p className="font-bold text-slate-900">{inv.seller.storeName}</p>
                      <p className="text-xs text-slate-600">{inv.seller.address}</p>
                      <p className="text-xs text-slate-700">Phone: {inv.seller.phone}</p>
                      {inv.seller.gstin && (
                        <p className="text-xs text-slate-700">GSTIN: {inv.seller.gstin}</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-emerald-600" /> Customer & Delivery Region
                      </p>
                      <p className="font-bold text-slate-900">{inv.customerName}</p>
                      <p className="text-xs text-slate-600">{inv.shippingAddress}</p>
                      <p className="text-xs text-slate-700">Phone: {inv.customerPhone}</p>
                      <div className="pt-1">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                          📍 {inv.deliveryZoneLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full min-w-[460px] text-left text-xs sm:text-sm">
                      <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="p-3 font-bold">Item</th>
                          <th className="p-3 font-bold text-center">Qty</th>
                          <th className="p-3 font-bold text-right">Unit Price</th>
                          <th className="p-3 font-bold text-right">GST</th>
                          <th className="p-3 font-bold text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {inv.items.map((it) => (
                          <tr key={it.id}>
                            <td className="p-3 font-medium text-slate-900">{it.productName}</td>
                            <td className="p-3 text-center tabular-nums">{it.quantity}</td>
                            <td className="p-3 text-right tabular-nums">{formatCurrency(it.price)}</td>
                            <td className="p-3 text-right tabular-nums text-emerald-700">
                              {formatCurrency(it.gstAmount)}
                            </td>
                            <td className="p-3 text-right tabular-nums font-bold text-slate-900">
                              {formatCurrency(it.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                    <div className="text-xs text-slate-600 space-y-1">
                      <p>
                        <span className="font-semibold text-slate-800">Date:</span>{" "}
                        {formatDate(inv.date)}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-800">Payment Method:</span>{" "}
                        {inv.paymentMethodLabel || inv.paymentMethod || "Cash on Delivery"}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Truck className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="font-semibold text-slate-800">Delivery Region:</span>{" "}
                        {inv.deliveryRegion} ({inv.deliveryZone})
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal</span>
                        <span className="font-semibold text-slate-900">{formatCurrency(inv.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700">
                        <span>GST Total</span>
                        <span className="font-semibold">+{formatCurrency(inv.gstTotal)}</span>
                      </div>
                      {(!inv.isServiceOnly || inv.shippingCharge > 0) && (
                        <div className="flex justify-between text-slate-700">
                          <span>Delivery Charge</span>
                          <span className="font-semibold">
                            {inv.shippingCharge <= 0 ? "FREE" : `+${formatCurrency(inv.shippingCharge)}`}
                          </span>
                        </div>
                      )}
                      {inv.couponDiscount && inv.couponDiscount > 0 ? (
                        <div className="flex justify-between text-emerald-700">
                          <span>Coupon Discount</span>
                          <span className="font-semibold">-{formatCurrency(inv.couponDiscount)}</span>
                        </div>
                      ) : null}
                      <div className="pt-2 border-t border-slate-300 flex justify-between text-base font-black text-slate-900">
                        <span>Grand Total</span>
                        <span>{formatCurrency(inv.grandTotal)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
