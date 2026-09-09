"use client"

import React, { useState, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Badge } from "@/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import {
  Mail,
  Send,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Play,
  Pause,
  StopCircle,
  FileText,
  Clock,
  Building2,
  UtensilsCrossed,
  Package,
  Wrench,
  Users,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

interface OnboardingReminderWizardModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialSellerType?: "ALL" | "PRODUCT" | "SERVICE" | "HOTEL" | "RESTAURANT"
  onFinished?: () => void
}

interface ScannedSeller {
  id: string
  sellerType: "PRODUCT" | "SERVICE" | "HOTEL" | "RESTAURANT"
  userName: string | null
  userEmail: string | null
  businessName: string | null
  onboardingStep: number
  missingDocuments: string[]
  missingSteps: string[]
}

interface ActivityLogItem {
  id: string
  timestamp: string
  sellerName: string
  email: string
  sellerType: string
  missingCount: number
  status: "success" | "failed" | "skipped"
  message?: string
}

export function OnboardingReminderWizardModal({
  open,
  onOpenChange,
  initialSellerType = "ALL",
  onFinished,
}: OnboardingReminderWizardModalProps) {
  // Wizard Phase: "preview" | "running" | "completed"
  const [phase, setPhase] = useState<"preview" | "running" | "completed">("preview")

  // Options
  const [sellerType, setSellerType] = useState<string>(initialSellerType)
  const [batchSize] = useState<number>(5)

  // Scanned / Preview Data
  const [isScanning, setIsScanning] = useState<boolean>(false)
  const [scannedSellers, setScannedSellers] = useState<ScannedSeller[]>([])
  const [scanStats, setScanStats] = useState<{
    scannedTotal: number
    pendingTotal: number
    byType: { product: number; service: number; hotel: number; restaurant: number }
  } | null>(null)
  const [expandedSellerId, setExpandedSellerId] = useState<string | null>(null)

  // Queue Runner State
  const [isRunning, setIsRunning] = useState<boolean>(false)
  const isPausedRef = useRef<boolean>(false)
  const isCancelledRef = useRef<boolean>(false)
  const [processedCount, setProcessedCount] = useState<number>(0)
  const [sentCount, setSentCount] = useState<number>(0)
  const [failedCount, setFailedCount] = useState<number>(0)
  const [logs, setLogs] = useState<ActivityLogItem[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)

  // Reset when opened
  useEffect(() => {
    if (open) {
      setPhase("preview")
      setSellerType(initialSellerType)
      setScannedSellers([])
      setScanStats(null)
      setProcessedCount(0)
      setSentCount(0)
      setFailedCount(0)
      setLogs([])
      isPausedRef.current = false
      isCancelledRef.current = false
      loadPreview(initialSellerType)
    }
  }, [open, initialSellerType])

  // Scroll logs to bottom
  useEffect(() => {
    if (phase === "running" && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [logs, phase])

  // Load preview sweep
  const loadPreview = async (typeToScan = sellerType) => {
    setIsScanning(true)
    try {
      const res = await fetch(
        `/api/admin/sellers/send-onboarding-reminders?dryRun=true&sellerType=${typeToScan}&limit=500`
      )
      const data = await res.json()
      if (res.ok && data.success) {
        setScannedSellers(data.sellers || [])
        setScanStats({
          scannedTotal: data.stats.scannedTotal || 0,
          pendingTotal: data.stats.pendingTotal || 0,
          byType: data.stats.byType || { product: 0, service: 0, hotel: 0, restaurant: 0 },
        })
      }
    } catch (err) {
      console.error("Failed to load onboarding preview sweep:", err)
    } finally {
      setIsScanning(false)
    }
  }

  // Start chunked queue processing
  const handleStartQueue = async () => {
    if (scannedSellers.length === 0) return

    setPhase("running")
    setIsRunning(true)
    isPausedRef.current = false
    isCancelledRef.current = false
    setProcessedCount(0)
    setSentCount(0)
    setFailedCount(0)
    setLogs([])

    const total = scannedSellers.length
    let processed = 0
    let sent = 0
    let failed = 0

    // Process in chunks of batchSize
    for (let i = 0; i < total; i += batchSize) {
      // Check cancellation
      if (isCancelledRef.current) {
        break
      }

      // Check pause loop
      while (isPausedRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        if (isCancelledRef.current) break
      }
      if (isCancelledRef.current) break

      const chunk = scannedSellers.slice(i, i + batchSize)
      const chunkIds = chunk.map((s) => s.id)

      try {
        const res = await fetch("/api/admin/sellers/send-onboarding-reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sellerIds: chunkIds,
            dryRun: false,
            sellerType,
          }),
        })

        const data = await res.json()

        if (res.ok && data.success && Array.isArray(data.sellers)) {
          for (const item of data.sellers) {
            processed++
            const isSuccess = !!item.emailSent
            if (isSuccess) {
              sent++
            } else {
              failed++
            }

            setLogs((prev) => [
              ...prev,
              {
                id: `${item.id}-${Date.now()}-${Math.random()}`,
                timestamp: new Date().toLocaleTimeString(),
                sellerName: item.businessName || item.userName || "Seller Partner",
                email: item.userEmail || "No email",
                sellerType: item.sellerType,
                missingCount: (item.missingDocuments || []).length,
                status: isSuccess ? "success" : "failed",
                message: item.emailSent
                  ? `Reminder email sent successfully (Calculated ${item.missingDocuments.length} missing docs)`
                  : `Failed to deliver email: ${item.error || "Unknown error"}`,
              },
            ])
          }
        } else {
          // Fallback if chunk failed completely
          for (const s of chunk) {
            processed++
            failed++
            setLogs((prev) => [
              ...prev,
              {
                id: `${s.id}-${Date.now()}-${Math.random()}`,
                timestamp: new Date().toLocaleTimeString(),
                sellerName: s.businessName || s.userName || "Seller",
                email: s.userEmail || "No email",
                sellerType: s.sellerType,
                missingCount: s.missingDocuments.length,
                status: "failed",
                message: data.error || "Batch request failed",
              },
            ])
          }
        }
      } catch (err: any) {
        for (const s of chunk) {
          processed++
          failed++
          setLogs((prev) => [
            ...prev,
            {
              id: `${s.id}-${Date.now()}-${Math.random()}`,
              timestamp: new Date().toLocaleTimeString(),
              sellerName: s.businessName || s.userName || "Seller",
              email: s.userEmail || "No email",
              sellerType: s.sellerType,
              missingCount: s.missingDocuments.length,
              status: "failed",
              message: err?.message || "Network error in batch",
            },
          ])
        }
      }

      setProcessedCount(processed)
      setSentCount(sent)
      setFailedCount(failed)

      // Slight safety delay between chunks to be kind to SendGrid
      await new Promise((resolve) => setTimeout(resolve, 600))
    }

    setIsRunning(false)
    setPhase("completed")
    onFinished?.()
  }

  const handleTogglePause = () => {
    isPausedRef.current = !isPausedRef.current
  }

  const handleCancelQueue = () => {
    isCancelledRef.current = true
    isPausedRef.current = false
    setIsRunning(false)
  }

  const renderSellerTypeBadge = (type: string) => {
    switch (type) {
      case "PRODUCT":
        return (
          <Badge className="bg-blue-50 text-blue-700 border-blue-200 gap-1 text-[10px]">
            <Package className="h-2.5 w-2.5" /> Product
          </Badge>
        )
      case "SERVICE":
        return (
          <Badge className="bg-purple-50 text-purple-700 border-purple-200 gap-1 text-[10px]">
            <Wrench className="h-2.5 w-2.5" /> Service
          </Badge>
        )
      case "HOTEL":
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 text-[10px]">
            <Building2 className="h-2.5 w-2.5" /> Hotel
          </Badge>
        )
      case "RESTAURANT":
        return (
          <Badge className="bg-amber-50 text-amber-700 border-amber-200 gap-1 text-[10px]">
            <UtensilsCrossed className="h-2.5 w-2.5" /> Restaurant
          </Badge>
        )
      default:
        return <Badge variant="outline">{type}</Badge>
    }
  }

  const progressPercentage =
    scannedSellers.length > 0 ? Math.round((processedCount / scannedSellers.length) * 100) : 0

  return (
    <Dialog open={open} onOpenChange={isRunning ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[720px] rounded-3xl p-6 border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="space-y-1 shrink-0 pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  Bulk Onboarding Reminder System
                  <Badge variant="secondary" className="text-[10px] font-semibold">
                    Queue Batching
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Target sellers with incomplete onboarding or missing documents with calculated requirements.
                </DialogDescription>
              </div>
            </div>

            {/* Active sweep count badge */}
            {scannedSellers.length > 0 && (
              <Badge className="bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 font-semibold text-xs">
                {scannedSellers.length} Incomplete {scannedSellers.length === 1 ? "Seller" : "Sellers"}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* ── PHASE 1: CONFIGURATION & PREVIEW ── */}
        {phase === "preview" && (
          <div className="space-y-4 py-3 overflow-y-auto flex-1 pr-1">
            {/* Filter Toolbar */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="max-w-md space-y-1.5">
                <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Target Category
                </Label>
                <Select
                  value={sellerType}
                  onValueChange={(val) => {
                    setSellerType(val)
                    loadPreview(val)
                  }}
                  disabled={isScanning}
                >
                  <SelectTrigger className="rounded-xl text-xs h-9 bg-white dark:bg-slate-950">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl text-xs">
                    <SelectItem value="ALL">All Categories (Products, Services, Hotels, Restaurants)</SelectItem>
                    <SelectItem value="PRODUCT">Product Sellers Only</SelectItem>
                    <SelectItem value="SERVICE">Service Providers Only</SelectItem>
                    <SelectItem value="HOTEL">Hotel Partners Only</SelectItem>
                    <SelectItem value="RESTAURANT">Restaurant Partners Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Scan Status Summary Card */}
            {isScanning ? (
              <div className="p-8 rounded-2xl border border-dashed text-center space-y-2 text-slate-500">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600" />
                <p className="text-xs font-semibold">Scanning database & calculating missing documents...</p>
              </div>
            ) : scanStats ? (
              <div className="space-y-3">
                {/* Stats Breakdown Card */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/60">
                    <p className="text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-300">Pending Total</p>
                    <p className="text-lg font-black text-indigo-900 dark:text-indigo-100">{scanStats.pendingTotal}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60">
                    <p className="text-[10px] uppercase font-bold text-blue-700">Product</p>
                    <p className="text-base font-bold text-blue-900">{scanStats.byType.product}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60">
                    <p className="text-[10px] uppercase font-bold text-purple-700">Service</p>
                    <p className="text-base font-bold text-purple-900">{scanStats.byType.service}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60">
                    <p className="text-[10px] uppercase font-bold text-emerald-700">Hotel</p>
                    <p className="text-base font-bold text-emerald-900">{scanStats.byType.hotel}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60">
                    <p className="text-[10px] uppercase font-bold text-amber-700">Restaurant</p>
                    <p className="text-base font-bold text-amber-900">{scanStats.byType.restaurant}</p>
                  </div>
                </div>

                {/* Seller Preview List with Missing Documents */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
                    <span>Identified Incomplete Sellers ({scannedSellers.length})</span>
                    <span>Exact Missing Requirements Calculated</span>
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-1.5 p-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border text-xs">
                    {scannedSellers.length === 0 ? (
                      <p className="p-6 text-center text-xs text-slate-400 italic">
                        No incomplete sellers found for this category! All partners are verified or complete.
                      </p>
                    ) : (
                      scannedSellers.map((s) => {
                        const isExpanded = expandedSellerId === s.id
                        return (
                          <div
                            key={s.id}
                            className="p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 space-y-1.5 transition-all"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 truncate">
                                <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                                  {s.businessName || s.userName || "Seller"}
                                </span>
                                <span className="text-[11px] text-slate-400 truncate">&lt;{s.userEmail}&gt;</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {renderSellerTypeBadge(s.sellerType)}
                                <Badge variant="outline" className="text-[10px] font-semibold text-slate-500">
                                  Step {s.onboardingStep}/6
                                </Badge>
                                <button
                                  type="button"
                                  onClick={() => setExpandedSellerId(isExpanded ? null : s.id)}
                                  className="text-slate-400 hover:text-slate-600 p-0.5"
                                  title="View missing docs"
                                >
                                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            </div>

                            {/* Missing docs badges preview */}
                            <div className="flex flex-wrap gap-1 items-center pt-0.5">
                              {s.missingDocuments.length > 0 ? (
                                s.missingDocuments.slice(0, isExpanded ? undefined : 2).map((doc, idx) => (
                                  <Badge
                                    key={idx}
                                    variant="outline"
                                    className="text-[9px] bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300"
                                  >
                                    ⚠️ {doc}
                                  </Badge>
                                ))
                              ) : (
                                <Badge variant="outline" className="text-[9px] text-slate-500">
                                  Step progression pending
                                </Badge>
                              )}
                              {!isExpanded && s.missingDocuments.length > 2 && (
                                <span
                                  onClick={() => setExpandedSellerId(s.id)}
                                  className="text-[10px] text-blue-600 font-semibold cursor-pointer hover:underline"
                                >
                                  +{s.missingDocuments.length - 2} more
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* ── PHASE 2: QUEUE RUNNING ── */}
        {phase === "running" && (
          <div className="space-y-4 py-3 overflow-y-auto flex-1 pr-1">
            {/* Progress Bar Card */}
            <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/80 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-indigo-950 dark:text-indigo-200">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                  Processing Queue ({batchSize} per batch)...
                </span>
                <span>
                  {processedCount} / {scannedSellers.length} ({progressPercentage}%)
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>

              {/* Counter Tally */}
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-900/80 text-xs">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Target</span>
                  <p className="font-bold text-slate-800 dark:text-slate-100">{scannedSellers.length}</p>
                </div>
                <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-xs text-emerald-800 dark:text-emerald-200">
                  <span className="text-[10px] uppercase font-semibold">
                    Sent
                  </span>
                  <p className="font-bold">{sentCount}</p>
                </div>
                <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-xs text-rose-800 dark:text-rose-200">
                  <span className="text-[10px] uppercase font-semibold">Failed</span>
                  <p className="font-bold">{failedCount}</p>
                </div>
              </div>
            </div>

            {/* Live Activity Stream Log */}
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Live Queue Activity Stream
              </span>
              <div className="h-52 overflow-y-auto p-3 rounded-2xl bg-slate-950 text-slate-100 font-mono text-[11px] space-y-2 border">
                {logs.length === 0 ? (
                  <p className="text-slate-500 italic text-center py-4">Starting batch execution...</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                      <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                      {log.status === "success" ? (
                        <span className="text-emerald-400 font-bold shrink-0">✓</span>
                      ) : (
                        <span className="text-rose-400 font-bold shrink-0">✗</span>
                      )}
                      <div className="truncate">
                        <span className="font-semibold text-slate-200">{log.sellerName}</span>{" "}
                        <span className="text-slate-400">({log.email})</span> —{" "}
                        <span className={log.status === "success" ? "text-slate-300" : "text-rose-300"}>
                          {log.message}
                        </span>
                      </div>
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>
        )}

        {/* ── PHASE 3: COMPLETED ── */}
        {phase === "completed" && (
          <div className="space-y-4 py-6 text-center">
            <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">
                Onboarding Reminder Emails Sent!
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                All targeted sellers have received personalized reminder emails detailing their exact missing documents to complete verification.
              </p>
            </div>

            {/* Results Card */}
            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border text-center">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Total Processed</p>
                <p className="text-xl font-black text-slate-800 dark:text-slate-100">{processedCount}</p>
              </div>
              <div>
                <p className="text-[10px] text-emerald-600 font-bold uppercase">
                  Delivered
                </p>
                <p className="text-xl font-black text-emerald-600">{sentCount}</p>
              </div>
              <div>
                <p className="text-[10px] text-rose-600 font-bold uppercase">Failed</p>
                <p className="text-xl font-black text-rose-600">{failedCount}</p>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t shrink-0">
          {phase === "preview" && (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="rounded-2xl text-xs h-9"
              >
                Close
              </Button>
              <Button
                onClick={handleStartQueue}
                disabled={isScanning || scannedSellers.length === 0}
                className="rounded-2xl text-xs h-9 font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-md shadow-indigo-600/20"
              >
                <Send className="h-3.5 w-3.5" />
                Send Reminder Emails ({scannedSellers.length})
              </Button>
            </>
          )}

          {phase === "running" && (
            <div className="flex items-center justify-between w-full">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancelQueue}
                className="rounded-2xl text-xs h-8.5 gap-1"
              >
                <StopCircle className="h-3.5 w-3.5" />
                Stop Queue
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTogglePause}
                  className="rounded-2xl text-xs h-8.5 gap-1"
                >
                  {isPausedRef.current ? (
                    <>
                      <Play className="h-3.5 w-3.5 text-emerald-600" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="h-3.5 w-3.5 text-amber-600" />
                      Pause
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {phase === "completed" && (
            <Button
              onClick={() => onOpenChange(false)}
              className="rounded-2xl text-xs h-9 font-bold bg-slate-900 hover:bg-slate-800 text-white w-full sm:w-auto px-6"
            >
              Done & Return
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
