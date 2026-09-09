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
import { Textarea } from "@/ui/textarea"
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
  Users,
  Building2,
  UtensilsCrossed,
  Package,
  Wrench,
  Megaphone,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  ShieldAlert,
} from "lucide-react"

export interface BulkCustomEmailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialSellerType?: "ALL" | "PRODUCT" | "SERVICE" | "HOTEL" | "RESTAURANT"
  onFinished?: () => void
}

interface RecipientPreviewItem {
  id: string
  sellerType: "PRODUCT" | "SERVICE" | "HOTEL" | "RESTAURANT"
  name: string | null
  businessName: string | null
  email: string
  status: string
  isApproved: boolean
  isSuspended: boolean
}

interface ActivityLogItem {
  id: string
  timestamp: string
  email: string
  sellerName: string | null
  sellerType: string
  status: "success" | "failed"
  message?: string
}

const PRESET_TEMPLATES = [
  {
    id: "custom",
    label: "Custom Blank Message (Write your own)",
    subject: "",
    message: "",
  },
  {
    id: "platform_update",
    label: "Platform Update & Scheduled Maintenance",
    subject: "Notice: Scheduled Platform Maintenance & Feature Updates on MEEEM",
    message: `Dear Valued Partner,\n\nWe would like to inform you that MEEEM will be performing scheduled system maintenance to enhance platform speed, security, and order processing capabilities.\n\nDate & Time: Sunday from 02:00 AM to 04:00 AM GMT.\n\nDuring this brief window, your seller dashboard may experience momentary downtime. Customer orders placed prior will be safeguarded and processed without interruption.\n\nThank you for your cooperation and continued trust as we build a better platform for you.`,
  },
  {
    id: "festive_promo",
    label: "Festive & Holiday Campaign Opportunity",
    subject: "Boost Your Sales: Join the Upcoming MEEEM Mega Promotion Campaign",
    message: `Dear Seller Partner,\n\nMEEEM is launching a major promotional shopping campaign across Sierra Leone starting this month! As a valued vendor, you are invited to feature your best-selling products, menus, or services on our homepage flash deals banner.\n\nHow to participate:\n1. Log in to your vendor dashboard.\n2. Review your inventory, menu items, or booking availability.\n3. Add promotional discounts or bundle offers to attract more shoppers.\n\nOur team is here to support you in maximizing your sales during this peak season.`,
  },
  {
    id: "policy_update",
    label: "Vendor Policies & Compliance Guidelines",
    subject: "Important Reminder: MEEEM Vendor Operating Standards & Policies",
    message: `Dear Partner,\n\nTo ensure consistent quality, buyer satisfaction, and fast fulfillment across the MEEEM marketplace, please take a moment to review our vendor guidelines:\n\n- Order Fulfillment: Please accept and dispatch orders promptly within the designated SLA.\n- Accurate Pricing & Stock: Ensure all listed prices, inventory counts, or room availabilities are always up to date.\n- Quality Assurance: Only list authentic products and fresh ingredients.\n\nThank you for maintaining high standards for all MEEEM customers.`,
  },
  {
    id: "urgent_notice",
    label: "Urgent Operational Notice",
    subject: "Urgent Operational Update for All MEEEM Merchant Partners",
    message: `Dear Partner,\n\nPlease read this urgent update from the MEEEM Operations team regarding current delivery logistics and order processing protocols.\n\nPlease verify that your store operating hours and contact numbers in the vendor dashboard are completely accurate so our customer support and dispatch riders can coordinate with your staff without delay.\n\nIf you have any questions, please reach out to operations support immediately.`,
  },
]

export function BulkCustomEmailModal({
  open,
  onOpenChange,
  initialSellerType = "ALL",
  onFinished,
}: BulkCustomEmailModalProps) {
  // Wizard Phase: "compose" | "running" | "completed"
  const [phase, setPhase] = useState<"compose" | "running" | "completed">("compose")

  // Audience & Filter State
  const [sellerType, setSellerType] = useState<string>(initialSellerType)
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [selectedTemplate, setSelectedTemplate] = useState("custom")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [senderLabel, setSenderLabel] = useState("MEEEM Partner Operations")
  const [batchSize] = useState(5)

  // Preview & Recipient Data
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [totalRecipients, setTotalRecipients] = useState(0)
  const [byTypeCount, setByTypeCount] = useState({
    product: 0,
    service: 0,
    hotel: 0,
    restaurant: 0,
  })
  const [previewRecipients, setPreviewRecipients] = useState<RecipientPreviewItem[]>([])
  const [showRecipientList, setShowRecipientList] = useState(false)

  // Queue Runner State
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [currentOffset, setCurrentOffset] = useState(0)
  const [sentCount, setSentCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([])

  const isPausedRef = useRef(false)
  const isCancelledRef = useRef(false)
  const activityScrollRef = useRef<HTMLDivElement>(null)

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setPhase("compose")
      setSellerType(initialSellerType)
      setStatusFilter("ALL")
      setSelectedTemplate("custom")
      setSubject("")
      setMessage("")
      setIsRunning(false)
      setIsPaused(false)
      setCurrentOffset(0)
      setSentCount(0)
      setFailedCount(0)
      setActivityLogs([])
      isPausedRef.current = false
      isCancelledRef.current = false
    }
  }, [open, initialSellerType])

  // Fetch preview count whenever audience filter changes
  useEffect(() => {
    if (!open || phase !== "compose") return

    let isMounted = true
    setIsLoadingPreview(true)

    const params = new URLSearchParams()
    params.set("sellerType", sellerType)
    params.set("status", statusFilter)

    fetch(`/api/admin/sellers/send-bulk-custom-email?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return
        if (data.success) {
          setTotalRecipients(data.total || 0)
          setByTypeCount(
            data.byType || { product: 0, service: 0, hotel: 0, restaurant: 0 }
          )
          setPreviewRecipients(data.recipients || [])
        }
      })
      .catch((err) => {
        console.error("Failed to load recipient preview:", err)
      })
      .finally(() => {
        if (isMounted) setIsLoadingPreview(false)
      })

    return () => {
      isMounted = false
    }
  }, [open, sellerType, statusFilter, phase])

  // Scroll to bottom of activity logs
  useEffect(() => {
    if (activityScrollRef.current) {
      activityScrollRef.current.scrollTop = activityScrollRef.current.scrollHeight
    }
  }, [activityLogs])

  // Handle template selection
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId)
    const found = PRESET_TEMPLATES.find((t) => t.id === templateId)
    if (found) {
      if (templateId !== "custom") {
        setSubject(found.subject)
        setMessage(found.message)
      }
    }
  }

  // Start sending queue runner
  const handleStartSending = async () => {
    if (!subject.trim() || !message.trim()) {
      alert("Please provide both a Subject and Message body before sending.")
      return
    }

    setPhase("running")
    setIsRunning(true)
    setIsPaused(false)
    setCurrentOffset(0)
    setSentCount(0)
    setFailedCount(0)
    setActivityLogs([])
    isPausedRef.current = false
    isCancelledRef.current = false

    let offset = 0
    let totalSent = 0
    let totalFailed = 0

    while (!isCancelledRef.current) {
      // Check pause
      while (isPausedRef.current && !isCancelledRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
      if (isCancelledRef.current) break

      try {
        const res = await fetch("/api/admin/sellers/send-bulk-custom-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sellerType,
            statusFilter,
            subject: subject.trim(),
            message: message.trim(),
            senderLabel: senderLabel.trim(),
            dryRun: false,
            offset,
            limit: batchSize,
          }),
        })

        const data = await res.json()

        if (!data.success) {
          console.error("Batch error:", data.error)
          setActivityLogs((prev) => [
            ...prev,
            {
              id: `${Date.now()}-err`,
              timestamp: new Date().toLocaleTimeString(),
              email: "System",
              sellerName: "Batch Error",
              sellerType: "SYSTEM",
              status: "failed",
              message: data.error || "Batch request failed",
            },
          ])
          totalFailed += batchSize
          setFailedCount(totalFailed)
          break
        }

        // Add to stats
        totalSent += data.sent || 0
        totalFailed += data.failed || 0
        setSentCount(totalSent)
        setFailedCount(totalFailed)

        // Log results
        if (Array.isArray(data.results)) {
          const newLogs: ActivityLogItem[] = data.results.map((r: any) => ({
            id: `${r.id}-${Date.now()}-${Math.random()}`,
            timestamp: new Date().toLocaleTimeString(),
            email: r.email,
            sellerName: r.sellerName,
            sellerType: r.sellerType,
            status: r.status,
            message: r.error,
          }))
          setActivityLogs((prev) => [...prev, ...newLogs])
        }

        offset = data.nextOffset ?? offset + batchSize
        setCurrentOffset(offset)

        if (!data.hasMore || offset >= data.totalEligible) {
          break
        }

        // Brief delay between batches to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 350))
      } catch (err: any) {
        console.error("Queue execution error:", err)
        setActivityLogs((prev) => [
          ...prev,
          {
            id: `${Date.now()}-net-err`,
            timestamp: new Date().toLocaleTimeString(),
            email: "Network",
            sellerName: "Connection",
            sellerType: "ERROR",
            status: "failed",
            message: err?.message || "Network request failed",
          },
        ])
        break
      }
    }

    setIsRunning(false)
    setPhase("completed")
    if (onFinished) onFinished()
  }

  const handlePause = () => {
    isPausedRef.current = true
    setIsPaused(true)
  }

  const handleResume = () => {
    isPausedRef.current = false
    setIsPaused(false)
  }

  const handleCancel = () => {
    if (confirm("Are you sure you want to stop sending emails? Any remaining emails in the queue will be cancelled.")) {
      isCancelledRef.current = true
      setIsRunning(false)
      setPhase("completed")
    }
  }

  const progressPercent =
    totalRecipients > 0
      ? Math.min(100, Math.round(((sentCount + failedCount) / totalRecipients) * 100))
      : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0 rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-800 p-5 sm:p-6 text-white rounded-t-2xl relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="relative z-10 flex items-start gap-3.5">
            <div className="p-2.5 bg-white/15 backdrop-blur-md rounded-xl border border-white/20 shadow-inner shrink-0">
              <Megaphone className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Send Email to Sellers (Broadcast)
                </DialogTitle>
                <Badge className="bg-white/20 text-white border-white/20 text-[10px] font-semibold tracking-wider uppercase">
                  Bulk Dispatch
                </Badge>
              </div>
              <DialogDescription className="text-blue-100 text-xs sm:text-sm mt-1 leading-relaxed">
                Send an email notice, update, or campaign invitation to multiple sellers simultaneously with live progress tracking.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* BODY CONTENT */}
        <div className="p-5 sm:p-6 space-y-6">
          {/* ════════ PHASE 1: COMPOSE & TARGETING ════════ */}
          {phase === "compose" && (
            <div className="space-y-5">
              {/* Audience Targeting Selectors */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Users className="h-4 w-4 text-indigo-500" />
                    Target Audience & Filters
                  </h4>
                  {isLoadingPreview ? (
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Counting recipients...
                    </span>
                  ) : (
                    <Badge className="bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 text-xs font-bold px-2.5 py-0.5">
                      {totalRecipients} Recipients Selected
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 block">
                      Seller Category
                    </Label>
                    <Select value={sellerType} onValueChange={setSellerType}>
                      <SelectTrigger className="rounded-xl h-9.5 text-xs bg-white dark:bg-slate-900">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Categories (Products, Services, Hotels, Restaurants)</SelectItem>
                        <SelectItem value="PRODUCT">Product Sellers Only</SelectItem>
                        <SelectItem value="SERVICE">Service Providers Only</SelectItem>
                        <SelectItem value="HOTEL">Hotel Partners Only</SelectItem>
                        <SelectItem value="RESTAURANT">Restaurant Partners Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 block">
                      Account Status
                    </Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="rounded-xl h-9.5 text-xs bg-white dark:bg-slate-900">
                        <SelectValue placeholder="Select Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Sellers (Active, Pending, Suspended)</SelectItem>
                        <SelectItem value="ACTIVE">Active & Approved Only</SelectItem>
                        <SelectItem value="PENDING">Pending Setup / Unapproved Only</SelectItem>
                        <SelectItem value="SUSPENDED">Suspended Sellers Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Category Count Breakdown */}
                <div className="flex items-center gap-2 pt-1 flex-wrap text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-500">Breakdown:</span>
                  <span className="inline-flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                    <Package className="h-3 w-3 text-blue-500" /> Products: <b>{byTypeCount.product}</b>
                  </span>
                  <span className="inline-flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                    <Wrench className="h-3 w-3 text-purple-500" /> Services: <b>{byTypeCount.service}</b>
                  </span>
                  <span className="inline-flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                    <Building2 className="h-3 w-3 text-emerald-500" /> Hotels: <b>{byTypeCount.hotel}</b>
                  </span>
                  <span className="inline-flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                    <UtensilsCrossed className="h-3 w-3 text-orange-500" /> Restaurants: <b>{byTypeCount.restaurant}</b>
                  </span>

                  <button
                    type="button"
                    onClick={() => setShowRecipientList(!showRecipientList)}
                    className="ml-auto text-indigo-600 dark:text-indigo-400 hover:underline font-medium inline-flex items-center gap-1"
                  >
                    {showRecipientList ? (
                      <>
                        Hide Preview <ChevronUp className="h-3.5 w-3.5" />
                      </>
                    ) : (
                      <>
                        View First 100 Recipients <ChevronDown className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </div>

                {/* Expandable Recipient Preview List */}
                {showRecipientList && (
                  <div className="mt-3 max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                    {previewRecipients.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-2">No recipients found matching current filter.</p>
                    ) : (
                      previewRecipients.map((rec) => (
                        <div key={rec.id} className="py-1.5 flex items-center justify-between text-xs">
                          <div className="min-w-0 pr-2">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                              {rec.name || rec.businessName || "Partner"}
                            </span>
                            <span className="text-slate-400 text-[11px] font-mono truncate block">
                              {rec.email}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 uppercase">
                              {rec.sellerType}
                            </Badge>
                            {rec.isSuspended && (
                              <Badge className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0">Suspended</Badge>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Template Presets */}
              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                  Email Template Presets (Optional)
                </Label>
                <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                  <SelectTrigger className="rounded-xl h-9.5 text-xs bg-slate-50/70 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <SelectValue placeholder="Choose a template preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESET_TEMPLATES.map((tmpl) => (
                      <SelectItem key={tmpl.id} value={tmpl.id} className="text-xs py-2">
                        {tmpl.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subject Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label htmlFor="broadcast-subject" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Subject Line <span className="text-red-500">*</span>
                  </Label>
                  <span className="text-[11px] text-slate-400">{subject.length}/150 characters</span>
                </div>
                <Input
                  id="broadcast-subject"
                  placeholder="e.g., Important Notice: Platform Maintenance and Order Guidelines"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value.slice(0, 150))}
                  className="rounded-xl h-10 text-xs sm:text-sm font-medium"
                />
              </div>

              {/* Sender Signature Label */}
              <div>
                <Label htmlFor="broadcast-sender" className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Sender Signature Label
                </Label>
                <Input
                  id="broadcast-sender"
                  placeholder="e.g., MEEEM Partner Operations"
                  value={senderLabel}
                  onChange={(e) => setSenderLabel(e.target.value)}
                  className="rounded-xl h-10 text-xs sm:text-sm"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  This signature will appear at the bottom of the email as the official sender signature.
                </p>
              </div>

              {/* Message Body Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label htmlFor="broadcast-message" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Message Body <span className="text-red-500">*</span>
                  </Label>
                  <span className="text-[11px] text-slate-400">{message.length} characters</span>
                </div>
                <Textarea
                  id="broadcast-message"
                  rows={8}
                  placeholder="Write your email content here. Paragraphs and line breaks will be preserved in the official branded template..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="rounded-xl text-xs sm:text-sm resize-y leading-relaxed font-sans"
                />
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
                  Note: The email will automatically include official MEEEM branding, personalized greeting (partner name), and support contact information.
                </p>
              </div>
            </div>
          )}

          {/* ════════ PHASE 2: QUEUE RUNNER ════════ */}
          {phase === "running" && (
            <div className="space-y-5 py-2">
              {/* Progress Summary Card */}
              <div className="p-5 bg-gradient-to-br from-indigo-50/80 via-blue-50/50 to-slate-50 dark:from-slate-900 dark:to-slate-800/80 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isRunning && !isPaused ? (
                      <Loader2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400 animate-spin" />
                    ) : isPaused ? (
                      <Pause className="h-5 w-5 text-amber-500" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    )}
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {isPaused ? "Broadcast Paused" : "Sending Broadcast in Batches..."}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Chunked delivery (5 recipients per batch) to ensure reliable dispatch.
                      </p>
                    </div>
                  </div>
                  <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                    {progressPercent}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-3 rounded-full overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 transition-all duration-300 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Metric counters */}
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-center shadow-sm">
                    <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">Total</span>
                    <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{totalRecipients}</span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-100 dark:border-emerald-950/40 text-center shadow-sm">
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block uppercase tracking-wider">
                      Sent
                    </span>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{sentCount}</span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-red-100 dark:border-red-950/40 text-center shadow-sm">
                    <span className="text-[11px] font-semibold text-red-600 dark:text-red-400 block uppercase tracking-wider">Failed</span>
                    <span className="text-lg font-bold text-red-600 dark:text-red-400">{failedCount}</span>
                  </div>
                </div>
              </div>

              {/* Activity Log Console */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    Live Activity Stream
                  </span>
                  <span>{activityLogs.length} events logged</span>
                </div>

                <div
                  ref={activityScrollRef}
                  className="h-56 overflow-y-auto bg-slate-900 text-slate-200 rounded-xl p-3 font-mono text-xs space-y-1.5 border border-slate-800 shadow-inner"
                >
                  {activityLogs.length === 0 ? (
                    <p className="text-slate-500 italic py-4 text-center">Starting batch worker...</p>
                  ) : (
                    activityLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                        <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                        {log.status === "success" ? (
                          <span className="text-emerald-400 shrink-0 font-bold">[SENT]</span>
                        ) : (
                          <span className="text-red-400 shrink-0 font-bold">[FAIL]</span>
                        )}
                        <span className="text-slate-300 font-sans truncate">
                          {log.sellerName || "Partner"} ({log.email})
                        </span>
                        {log.message && (
                          <span className="text-red-300 text-[11px] font-sans">
                            - {log.message}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Execution Controls */}
              <div className="flex items-center justify-end gap-2 pt-2">
                {isPaused ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleResume}
                    className="gap-1.5 text-xs font-semibold h-9 rounded-xl border-amber-300 text-amber-700 dark:text-amber-300"
                  >
                    <Play className="h-3.5 w-3.5" /> Resume
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePause}
                    disabled={!isRunning}
                    className="gap-1.5 text-xs font-semibold h-9 rounded-xl border-slate-300 text-slate-700 dark:text-slate-300"
                  >
                    <Pause className="h-3.5 w-3.5" /> Pause
                  </Button>
                )}

                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleCancel}
                  className="gap-1.5 text-xs font-semibold h-9 rounded-xl"
                >
                  <StopCircle className="h-3.5 w-3.5" /> Stop Queue
                </Button>
              </div>
            </div>
          )}

          {/* ════════ PHASE 3: COMPLETED SUMMARY ════════ */}
          {phase === "completed" && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Broadcast Dispatched Successfully
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  The message has been delivered to your selected seller partners.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto pt-2">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase block">
                    Successfully Sent
                  </span>
                  <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                    {sentCount}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                    Failed / Skipped
                  </span>
                  <span className="text-2xl font-black text-slate-700 dark:text-slate-300">
                    {failedCount}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <DialogFooter className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          {phase === "compose" && (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleStartSending}
                disabled={totalRecipients === 0 || !subject.trim() || !message.trim()}
                className="rounded-xl h-10 px-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-700 hover:from-blue-700 hover:to-violet-800 text-white gap-2 font-bold text-xs sm:text-sm shadow-md transition-all"
              >
                <Send className="h-4 w-4" />
                Send to {totalRecipients} {totalRecipients === 1 ? "Seller" : "Sellers"}
              </Button>
            </>
          )}

          {phase === "running" && (
            <div className="w-full flex justify-between items-center text-xs text-slate-500">
              <span>Do not close this window while queue is actively sending.</span>
              <span className="font-mono">{currentOffset} / {totalRecipients} processed</span>
            </div>
          )}

          {phase === "completed" && (
            <div className="w-full flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPhase("compose")}
                className="text-xs font-semibold rounded-xl"
              >
                Send Another Broadcast
              </Button>
              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                className="text-xs font-bold rounded-xl px-5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900"
              >
                Done
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
