"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  LifeBuoy,
  ArrowLeft,
  Mail,
  Phone,
  Clock,
  Send,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  Store,
  Briefcase,
  UtensilsCrossed,
  Building2,
  User,
  ShieldCheck,
  Check,
  CheckCheck,
  Copy,
  MessageSquare,
  Lock,
  RefreshCw,
  Globe,
  Smartphone,
  FileText,
  History,
  Headphones,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Textarea } from "@/ui/textarea"
import { Label } from "@/ui/label"
import { Badge } from "@/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/ui/alert"
import { cn } from "@/lib/utils"

interface Reply {
  id: string
  senderType: "USER" | "ADMIN"
  senderEmail?: string | null
  senderName?: string | null
  message: string
  sentEmail: boolean
  createdAt: string
}

interface SupportTicket {
  id: string
  ticketId: string
  source?: string | null // "IN_APP" | "PUBLIC"
  userType: "CUSTOMER" | "SELLER_PRODUCT" | "SELLER_SERVICE" | "SELLER_RESTAURANT" | "SELLER_HOTEL"
  name: string
  email: string
  mobile: string
  subject?: string | null
  message: string
  status: "PENDING" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "OPEN"
  adminNotes?: string | null
  adminLastReadAt?: string | null
  closedAt?: string | null
  closedBy?: string | null
  createdAt: string
  replies?: Reply[]
}

const USER_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string; avatarBg: string }> = {
  CUSTOMER: {
    label: "Customer",
    icon: <ShoppingBag className="w-4 h-4 text-indigo-600" />,
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
    avatarBg: "bg-indigo-600 text-white",
  },
  SELLER_PRODUCT: {
    label: "Product Seller",
    icon: <Store className="w-4 h-4 text-blue-600" />,
    color: "bg-blue-50 text-blue-700 border-blue-200",
    avatarBg: "bg-blue-600 text-white",
  },
  SELLER_SERVICE: {
    label: "Service Provider",
    icon: <Briefcase className="w-4 h-4 text-purple-600" />,
    color: "bg-purple-50 text-purple-700 border-purple-200",
    avatarBg: "bg-purple-600 text-white",
  },
  SELLER_RESTAURANT: {
    label: "Restaurant Partner",
    icon: <UtensilsCrossed className="w-4 h-4 text-emerald-600" />,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    avatarBg: "bg-emerald-600 text-white",
  },
  SELLER_HOTEL: {
    label: "Hotel Host",
    icon: <Building2 className="w-4 h-4 text-teal-600" />,
    color: "bg-teal-50 text-teal-700 border-teal-200",
    avatarBg: "bg-teal-600 text-white",
  },
}

function getInitials(name?: string) {
  if (!name) return "U"
  const parts = name.trim().split(" ")
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function AdminSupportDetailClient({ ticketIdOrDbId }: { ticketIdOrDbId: string }) {
  const router = useRouter()
  const [ticket, setTicket] = useState<SupportTicket | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  const [replyText, setReplyText] = useState("")
  const [markResolvedOnReply, setMarkResolvedOnReply] = useState(false)
  const [isSendingReply, setIsSendingReply] = useState(false)
  const [copiedEmail, setCopiedEmail] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const fetchTicket = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true)
      const res = await fetch(`/api/admin/support/${ticketIdOrDbId}`, {
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Failed to load ticket details.")
      }
      setTicket(data.ticket)
    } catch (err: any) {
      if (!silent) setErrorMessage(err.message || "Failed to load support ticket.")
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [ticketIdOrDbId])

  useEffect(() => {
    fetchTicket(false)
  }, [fetchTicket])

  // Live Auto-Sync: Poll for new messages every 3.5 seconds & on window focus to auto-read
  useEffect(() => {
    const interval = setInterval(() => {
      // Only poll silently if document is visible and not actively submitting
      if (document.visibilityState === "visible" && !isSendingReply) {
        fetchTicket(true)
      }
    }, 3500)

    let lastFocusTime = 0
    const handleFocus = () => {
      const now = Date.now()
      if (now - lastFocusTime > 4000) {
        lastFocusTime = now
        fetchTicket(true)
      }
    }
    window.addEventListener("focus", handleFocus)

    return () => {
      clearInterval(interval)
      window.removeEventListener("focus", handleFocus)
    }
  }, [fetchTicket, isSendingReply])

  // Automatically scroll to the latest message (WhatsApp feel)
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [ticket?.replies, isLoading])

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault()
    if (!replyText.trim() || !ticket) return

    setErrorMessage("")
    setSuccessMessage("")
    setIsSendingReply(true)

    try {
      const res = await fetch(`/api/admin/support/${ticket.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replyMessage: replyText.trim(),
          closeTicket: markResolvedOnReply,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Failed to send support reply.")
      }

      setReplyText("")
      setSuccessMessage(data.message || "Reply sent successfully and dispatched to user's email.")
      // Always re-fetch to get fresh adminLastReadAt and latest ticket state
      fetchTicket()
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to send reply. Please try again.")
    } finally {
      setIsSendingReply(false)
    }
  }

  async function handleStatusChange(newStatus: "PENDING" | "IN_PROGRESS" | "RESOLVED" | "CLOSED") {
    if (!ticket) return
    try {
      const res = await fetch(`/api/admin/support/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ticket) {
        setTicket((prev) => (prev ? { ...prev, status: newStatus } : null))
      }
    } catch (err) {
      console.error("Failed to update status:", err)
    }
  }

  const copyEmail = () => {
    if (!ticket?.email) return
    navigator.clipboard.writeText(ticket.email)
    setCopiedEmail(true)
    setTimeout(() => setCopiedEmail(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-24 text-center space-y-4">
        <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium text-slate-600">Loading support details...</p>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="container mx-auto py-16 px-4 max-w-2xl text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">Support Ticket Not Found</h2>
        <p className="text-sm text-slate-600">The requested ticket ID does not exist or has been deleted.</p>
        <Button asChild className="rounded-xl mt-2 bg-indigo-600 text-white">
          <Link href="/admin/support" prefetch={false}>Back to Support Hub</Link>
        </Button>
      </div>
    )
  }

  const roleMeta = USER_TYPE_LABELS[ticket.userType] || USER_TYPE_LABELS.CUSTOMER
  const isPending = ticket.status === "PENDING" || ticket.status === "OPEN"
  const isResolved = ticket.status === "RESOLVED"
  const isClosed = ticket.status === "CLOSED"
  const isInApp = ticket.source === "IN_APP"
  const replies = ticket.replies || []
  const adminReplies = replies.filter((r) => r.senderType === "ADMIN")
  const userInitials = getInitials(ticket.name)

  return (
    <div className="container mx-auto py-8 max-w-5xl space-y-6 px-4 sm:px-6">
      
      {/* Top Header & Status Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 border-slate-300 self-start"
        >
          <Link href="/admin/support" prefetch={false}>
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            <span>Back to All Tickets</span>
          </Link>
        </Button>

        {/* Status Actions */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Set Status:
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleStatusChange("PENDING")}
              className={cn(
                "px-3 py-1 rounded-xl text-xs font-bold transition-all",
                isPending
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              Pending
            </button>
            <button
              type="button"
              onClick={() => handleStatusChange("IN_PROGRESS")}
              className={cn(
                "px-3 py-1 rounded-xl text-xs font-bold transition-all",
                ticket.status === "IN_PROGRESS"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              In Progress
            </button>
            <button
              type="button"
              onClick={() => handleStatusChange("RESOLVED")}
              className={cn(
                "px-3 py-1 rounded-xl text-xs font-bold transition-all",
                isResolved
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              Resolved
            </button>
            <button
              type="button"
              onClick={() => handleStatusChange("CLOSED")}
              className={cn(
                "px-3 py-1 rounded-xl text-xs font-bold transition-all",
                isClosed
                  ? "bg-slate-700 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              Closed
            </button>
          </div>
        </div>
      </div>

      {/* Ticket Header & Contact Information */}
      <Card className="rounded-3xl border-slate-200/90 shadow-sm bg-white overflow-hidden">
        <div className="p-5 sm:p-6 bg-slate-50/80 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-xs font-extrabold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-200">
                {ticket.ticketId}
              </span>
              {isInApp ? (
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs font-semibold inline-flex items-center gap-1">
                  <Smartphone className="w-3 h-3" />
                  <span>In-App Chat Ticket</span>
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-semibold inline-flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  <span>Public Website Inquiry</span>
                </Badge>
              )}
              <Badge variant="outline" className={`inline-flex items-center gap-1.5 text-xs font-semibold ${roleMeta.color}`}>
                {roleMeta.icon}
                <span>{roleMeta.label}</span>
              </Badge>
              {isPending ? (
                <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs font-semibold">
                  Pending
                </Badge>
              ) : isResolved ? (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs font-semibold">
                  Resolved
                </Badge>
              ) : isClosed ? (
                <Badge className="bg-slate-100 text-slate-700 border-slate-300 text-xs font-semibold">
                  Closed
                </Badge>
              ) : (
                <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-xs font-semibold">
                  In Progress
                </Badge>
              )}
            </div>

            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              {ticket.subject || "Support Inquiry"}
            </h1>
          </div>

          <div className="text-xs text-slate-500 space-y-0.5 md:text-right shrink-0">
            <p>Created: <strong>{new Date(ticket.createdAt).toLocaleString()}</strong></p>
            {ticket.closedAt && (
              <p className="text-emerald-700">
                Resolved: <strong>{new Date(ticket.closedAt).toLocaleString()}</strong>
              </p>
            )}
          </div>
        </div>

        {/* Contact Info Pills */}
        <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs bg-white">
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Requester Name
            </span>
            <p className="font-bold text-slate-900 text-sm">{ticket.name}</p>
          </div>

          <div className="space-y-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Email Address (Recipient)
            </span>
            <div className="flex items-center gap-1.5">
              <a href={`mailto:${ticket.email}`} className="font-mono font-bold text-indigo-600 hover:underline text-sm">
                {ticket.email}
              </a>
              <button
                type="button"
                onClick={copyEmail}
                className="text-slate-400 hover:text-slate-600"
                title="Copy email"
              >
                {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="space-y-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Mobile Phone
            </span>
            <p className="font-mono font-bold text-slate-900 text-sm">{ticket.mobile}</p>
          </div>
        </div>
      </Card>

      {/* CONDITIONAL RENDER: PUBLIC INQUIRY EMAIL VIEW vs IN-APP CHAT VIEW */}
      {!isInApp ? (
        /* ================= PUBLIC INQUIRY EMAIL WORKFLOW ================= */
        <div className="space-y-6">
          
          {/* Inquiry Message Card */}
          <Card className="rounded-3xl border-slate-200/90 shadow-sm bg-white overflow-hidden">
            <CardHeader className="p-5 sm:p-6 bg-slate-50 border-b border-slate-200 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <CardTitle className="text-base font-bold text-slate-900">
                  Public Inquiry Message
                </CardTitle>
              </div>
              <span className="text-xs text-slate-400">
                Submitted {new Date(ticket.createdAt).toLocaleDateString()} at {new Date(ticket.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </CardHeader>
            <CardContent className="p-6 sm:p-8">
              <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-5 sm:p-6">
                <p className="text-base sm:text-lg text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {ticket.message}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Email Reply Composer Card or Resolution Notice */}
          {isResolved || isClosed ? (
            <Card className="rounded-3xl border-emerald-200/90 shadow-sm bg-emerald-50/50 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-emerald-950">
                    This public inquiry is marked as {isResolved ? "Resolved" : "Closed"}
                  </h3>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Email replies are currently disabled for resolved inquiries.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                onClick={() => handleStatusChange("IN_PROGRESS")}
                className="rounded-2xl px-6 h-10 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs self-start sm:self-auto"
              >
                Reopen Inquiry to Reply
              </Button>
            </Card>
          ) : (
            <Card className="rounded-3xl border-slate-200/90 shadow-sm bg-white overflow-hidden">
              <CardHeader className="p-5 sm:p-6 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-indigo-600" />
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      Send Email Reply to Requester
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 mt-0.5">
                      Your response will be sent directly to <strong>{ticket.email}</strong> via SendGrid email service.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-8 space-y-4">
                {errorMessage && (
                  <Alert variant="destructive" className="rounded-2xl">
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
                  </Alert>
                )}

                {successMessage && (
                  <Alert className="rounded-2xl bg-emerald-50 border-emerald-200 text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <AlertDescription className="text-xs font-semibold">{successMessage}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSendReply} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Your Response Message
                    </Label>
                    <Textarea
                      rows={6}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={`Dear ${ticket.name},\n\nThank you for reaching out to MEEEM Support. Regarding your inquiry...`}
                      className="rounded-2xl text-sm border-slate-200 focus:border-indigo-500 leading-relaxed p-4"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={markResolvedOnReply}
                        onChange={(e) => setMarkResolvedOnReply(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 w-4 h-4"
                      />
                      <span>Mark inquiry as <strong>Resolved</strong> upon dispatching this email</span>
                    </label>

                    <Button
                      type="submit"
                      disabled={isSendingReply || !replyText.trim()}
                      className="rounded-2xl px-8 h-11 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 self-end sm:self-auto"
                    >
                      {isSendingReply ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Sending Email...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Send className="w-4 h-4" />
                          <span>Send Official Email Reply</span>
                        </div>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Previous Email Dispatches History */}
          {adminReplies.length > 0 && (
            <Card className="rounded-3xl border-slate-200/90 shadow-sm bg-white overflow-hidden">
              <CardHeader className="p-5 sm:p-6 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-slate-600" />
                  <CardTitle className="text-base font-bold text-slate-900">
                    Previous Email Dispatches ({adminReplies.length})
                  </CardTitle>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-4">
                {adminReplies.map((rep, idx) => (
                  <div key={rep.id || idx} className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{rep.senderName || "Admin Support"}</span>
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold">
                          Email Sent
                        </Badge>
                      </div>
                      <span className="text-slate-400">
                        {new Date(rep.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {rep.message}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

        </div>
      ) : (
        /* ================= IN-APP WHATSAPP-STYLE LIVE CHAT WORKFLOW ================= */
        <Card className="rounded-3xl border-slate-200/90 shadow-md bg-white overflow-hidden flex flex-col h-[650px]">
          
          {/* WhatsApp-Style Chat Header */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/90 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* User Avatar */}
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-xs", roleMeta.avatarBg)}>
                {userInitials}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900">
                    {ticket.name}
                  </h2>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" title="Active conversation" />
                </div>
                <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <span>{roleMeta.label}</span>
                  <span>•</span>
                  <span className="font-mono text-indigo-600 font-semibold">{ticket.ticketId}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => fetchTicket(false)}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs hover:bg-slate-50 transition-all"
            >
              <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
              <span>Sync Live</span>
            </button>
          </div>

          {/* WhatsApp-Feel Scrollable Conversation Area */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-100/70">
            {(!replies || replies.length === 0) ? (
              /* Fallback initial user message */
              <div className="flex items-start gap-2.5 max-w-lg">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-xs", roleMeta.avatarBg)}>
                  {userInitials}
                </div>
                <div className="flex flex-col items-start space-y-1">
                  <div className="rounded-2xl rounded-tl-xs bg-white border border-slate-200/90 p-4 shadow-xs text-slate-800 space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <span>{ticket.name}</span>
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-slate-500 font-semibold">
                        {roleMeta.label}
                      </Badge>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {ticket.message}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400 ml-1">
                    {new Date(ticket.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            ) : (
              replies.map((rep, idx) => {
                const isAdmin = rep.senderType === "ADMIN"

                return (
                  <div
                    key={rep.id || idx}
                    className={cn("flex items-end gap-2.5", isAdmin ? "justify-end" : "justify-start")}
                  >
                    {/* User Avatar on Left for User Messages */}
                    {!isAdmin && (
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-xs mb-5", roleMeta.avatarBg)}>
                        {userInitials}
                      </div>
                    )}

                    <div className={cn("flex flex-col max-w-md sm:max-w-lg", isAdmin ? "items-end" : "items-start")}>
                      <div
                        className={cn(
                          "rounded-2xl p-4 shadow-xs space-y-1.5",
                          isAdmin
                            ? "rounded-tr-xs bg-emerald-600 text-white"
                            : "rounded-tl-xs bg-white border border-slate-200/90 text-slate-800"
                        )}
                      >
                        <div className="flex items-center justify-between gap-4 text-xs font-bold">
                          {isAdmin ? (
                            <div className="flex items-center gap-1.5">
                              <Headphones className="w-3.5 h-3.5 text-emerald-200" />
                              <span className="text-emerald-100">{rep.senderName || "MEEEM Support"}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-900">{rep.senderName || ticket.name}</span>
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-slate-500 font-semibold">
                                {roleMeta.label}
                              </Badge>
                            </div>
                          )}

                          {isAdmin && rep.sentEmail && (
                            <Badge className="bg-white/20 text-white text-[9px] px-1.5 py-0 font-normal">
                              Email Sent
                            </Badge>
                          )}
                        </div>

                        <p className={cn("text-sm leading-relaxed whitespace-pre-wrap", isAdmin ? "text-emerald-50" : "text-slate-800")}>
                          {rep.message}
                        </p>
                      </div>

                      {/* Timestamp & Status Icon */}
                      <div className={cn("flex items-center gap-1 text-[10px] text-slate-400 mt-1 px-1", isAdmin ? "justify-end" : "justify-start")}>
                        <span>{new Date(rep.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        {isAdmin && (
                          <span title="Delivered & Read">
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-600 inline" />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Admin Avatar on Right for Admin Messages */}
                    {isAdmin && (
                      <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs mb-5">
                        <Headphones className="w-4 h-4 text-emerald-400" />
                      </div>
                    )}
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Admin Reply & Chat Input or Resolution Notice */}
          {isResolved || isClosed ? (
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 text-xs text-slate-700">
                <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>This in-app chat is marked as <strong>{isResolved ? "Resolved" : "Closed"}</strong>. Live messages are disabled.</span>
              </div>
              <Button
                type="button"
                onClick={() => handleStatusChange("IN_PROGRESS")}
                size="sm"
                className="rounded-xl px-4 h-8 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shrink-0 shadow-xs"
              >
                Reopen Ticket to Chat
              </Button>
            </div>
          ) : (
            <div className="p-4 border-t border-slate-200 bg-white space-y-3 shrink-0">
              {errorMessage && (
                <p className="text-xs text-rose-600 font-medium">{errorMessage}</p>
              )}

              <form onSubmit={handleSendReply} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Type a message to ${ticket.name}...`}
                    className="h-11 rounded-2xl text-sm border-slate-200 focus:border-emerald-500"
                  />
                  <Button
                    type="submit"
                    disabled={isSendingReply || !replyText.trim()}
                    className="rounded-2xl px-6 h-11 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-md shadow-emerald-600/20"
                  >
                    {isSendingReply ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5 mr-1.5" />
                        <span>Send</span>
                      </>
                    )}
                  </Button>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 px-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={markResolvedOnReply}
                      onChange={(e) => setMarkResolvedOnReply(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                    />
                    <span>Mark ticket as <strong>Resolved</strong> upon sending this message</span>
                  </label>

                  <span className="text-slate-400">
                    Instant live message sync
                  </span>
                </div>
              </form>
            </div>
          )}

        </Card>
      )}

    </div>
  )
}

export default AdminSupportDetailClient
