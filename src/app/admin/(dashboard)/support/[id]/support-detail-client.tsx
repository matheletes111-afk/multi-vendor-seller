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
  Copy,
  MessageSquare,
  Lock,
  RefreshCw,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
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
  userType: "CUSTOMER" | "SELLER_PRODUCT" | "SELLER_SERVICE" | "SELLER_RESTAURANT" | "SELLER_HOTEL"
  name: string
  email: string
  mobile: string
  subject?: string | null
  message: string
  status: "PENDING" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "OPEN"
  adminNotes?: string | null
  closedAt?: string | null
  closedBy?: string | null
  createdAt: string
  replies?: Reply[]
}

const USER_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  CUSTOMER: {
    label: "Customer",
    icon: <ShoppingBag className="w-4 h-4 text-indigo-600" />,
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  SELLER_PRODUCT: {
    label: "Product Seller",
    icon: <Store className="w-4 h-4 text-blue-600" />,
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  SELLER_SERVICE: {
    label: "Service Provider",
    icon: <Briefcase className="w-4 h-4 text-purple-600" />,
    color: "bg-purple-50 text-purple-700 border-purple-200",
  },
  SELLER_RESTAURANT: {
    label: "Restaurant Partner",
    icon: <UtensilsCrossed className="w-4 h-4 text-emerald-600" />,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  SELLER_HOTEL: {
    label: "Hotel Host",
    icon: <Building2 className="w-4 h-4 text-teal-600" />,
    color: "bg-teal-50 text-teal-700 border-teal-200",
  },
}

export function AdminSupportDetailClient({ ticketIdOrDbId }: { ticketIdOrDbId: string }) {
  const router = useRouter()
  const [ticket, setTicket] = useState<SupportTicket | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")

  const [replyText, setReplyText] = useState("")
  const [markResolvedOnReply, setMarkResolvedOnReply] = useState(false)
  const [isSendingReply, setIsSendingReply] = useState(false)
  const [copiedEmail, setCopiedEmail] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const fetchTicket = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch(`/api/admin/support/${ticketIdOrDbId}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Failed to load ticket details.")
      }
      setTicket(data.ticket)
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load support ticket.")
    } finally {
      setIsLoading(false)
    }
  }, [ticketIdOrDbId])

  useEffect(() => {
    fetchTicket()
  }, [fetchTicket])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [ticket?.replies])

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault()
    if (!replyText.trim() || !ticket) return

    setErrorMessage("")
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
      if (data.ticket) {
        setTicket(data.ticket)
      } else {
        fetchTicket()
      }
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
        <p className="text-sm font-medium text-slate-600">Loading support conversation...</p>
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
          <Link href="/admin/support">Back to Support Hub</Link>
        </Button>
      </div>
    )
  }

  const roleMeta = USER_TYPE_LABELS[ticket.userType] || USER_TYPE_LABELS.CUSTOMER
  const isPending = ticket.status === "PENDING" || ticket.status === "OPEN"
  const isResolved = ticket.status === "RESOLVED"
  const isClosed = ticket.status === "CLOSED"
  const replies = ticket.replies || []

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
          <Link href="/admin/support">
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

      {/* Ticket Requester Overview Card */}
      <Card className="rounded-3xl border-slate-200/90 shadow-sm bg-white overflow-hidden">
        <div className="p-5 sm:p-6 bg-slate-50/80 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-xs font-extrabold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-200">
                {ticket.ticketId}
              </span>
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
            <p className="font-bold text-slate-900">{ticket.name}</p>
          </div>

          <div className="space-y-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Email Address
            </span>
            <div className="flex items-center gap-1.5">
              <a href={`mailto:${ticket.email}`} className="font-mono font-bold text-indigo-600 hover:underline">
                {ticket.email}
              </a>
              <button
                type="button"
                onClick={copyEmail}
                className="text-slate-400 hover:text-slate-600"
                title="Copy email"
              >
                {copiedEmail ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>

          <div className="space-y-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Mobile Phone
            </span>
            <p className="font-mono font-bold text-slate-900">{ticket.mobile}</p>
          </div>
        </div>
      </Card>

      {/* Interactive Chat Message Thread */}
      <Card className="rounded-3xl border-slate-200/90 shadow-sm bg-white overflow-hidden flex flex-col h-[600px]">
        
        {/* Messages Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Live Chat & Message Thread
            </h2>
          </div>
          <button
            type="button"
            onClick={fetchTicket}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1"
          >
            <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
            <span>Sync</span>
          </button>
        </div>

        {/* Scrollable Conversation */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-50/40">
          
          {/* Initial Ticket Message from Requester */}
          <div className="flex flex-col items-start">
            <div className="max-w-md sm:max-w-lg rounded-2xl rounded-tl-xs bg-white border border-slate-200 p-4 shadow-xs space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <span>{ticket.name}</span>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-slate-500">
                  Requester
                </Badge>
              </div>
              <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                {ticket.message}
              </p>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 ml-1">
              {new Date(ticket.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          {/* Conversation Replies */}
          {replies.map((rep, idx) => {
            const isAdmin = rep.senderType === "ADMIN"

            return (
              <div
                key={rep.id || idx}
                className={cn("flex flex-col", isAdmin ? "items-end" : "items-start")}
              >
                <div
                  className={cn(
                    "max-w-md sm:max-w-lg rounded-2xl p-4 shadow-xs space-y-1",
                    isAdmin
                      ? "rounded-tr-xs bg-indigo-600 text-white"
                      : "rounded-tl-xs bg-white border border-slate-200 text-slate-800"
                  )}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    {isAdmin ? (
                      <>
                        <span className="text-indigo-100">{rep.senderName || "Admin Support"}</span>
                        {rep.sentEmail && (
                          <Badge className="bg-white/20 text-white text-[9px] px-1.5 py-0 font-normal">
                            Email Dispatched
                          </Badge>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="text-slate-900">{rep.senderName || ticket.name}</span>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-slate-500">
                          Requester
                        </Badge>
                      </>
                    )}
                  </div>

                  <p className={cn("text-sm leading-relaxed whitespace-pre-wrap", isAdmin ? "text-white" : "text-slate-800")}>
                    {rep.message}
                  </p>
                </div>

                <span className="text-[10px] text-slate-400 mt-1 px-1">
                  {new Date(rep.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Admin Reply & Chat Input */}
        <div className="p-4 border-t border-slate-200 bg-white space-y-3 shrink-0">
          {errorMessage && (
            <p className="text-xs text-rose-600 font-medium">{errorMessage}</p>
          )}

          <form onSubmit={handleSendReply} className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Reply to ${ticket.name} (will dispatch in chat thread & email)...`}
                className="h-11 rounded-2xl text-sm border-slate-200 focus:border-indigo-400"
              />
              <Button
                type="submit"
                disabled={isSendingReply || !replyText.trim()}
                className="rounded-2xl px-6 h-11 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 shadow-md shadow-indigo-600/20"
              >
                {isSendingReply ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    <span>Send Reply</span>
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
                  className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <span>Mark ticket as <strong>Resolved</strong> upon sending this message</span>
              </label>

              <span className="text-slate-400">
                Notifications dispatched via SendGrid to {ticket.email}
              </span>
            </div>
          </form>
        </div>

      </Card>

    </div>
  )
}

export default AdminSupportDetailClient

