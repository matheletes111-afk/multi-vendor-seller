"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import {
  LifeBuoy,
  Send,
  MessageSquare,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShoppingBag,
  Store,
  Briefcase,
  UtensilsCrossed,
  Building2,
  User,
  Check,
  CheckCheck,
  Headphones,
  Copy,
  ChevronRight,
  Inbox,
  Lock,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Textarea } from "@/ui/textarea"
import { Label } from "@/ui/label"
import { Badge } from "@/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/ui/alert"
import { cn } from "@/lib/utils"

export type PanelRole = "CUSTOMER" | "SELLER_PRODUCT" | "SELLER_SERVICE" | "SELLER_RESTAURANT" | "SELLER_HOTEL"

interface InAppSupportViewProps {
  role: PanelRole
  panelTitle: string
  panelSlug: string
  className?: string
}

interface Reply {
  id: string
  senderType: "USER" | "ADMIN"
  senderEmail?: string | null
  senderName?: string | null
  message: string
  sentEmail?: boolean
  createdAt: string
}

interface SupportTicket {
  id: string
  ticketId: string
  userType: PanelRole
  name: string
  email: string
  mobile: string
  subject?: string | null
  message: string
  status: "PENDING" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"
  createdAt: string
  replies?: Reply[]
  unreadCount?: number
}

const ROLE_ICONS: Record<PanelRole, React.ReactNode> = {
  CUSTOMER: <ShoppingBag className="w-4 h-4 text-indigo-600" />,
  SELLER_PRODUCT: <Store className="w-4 h-4 text-blue-600" />,
  SELLER_SERVICE: <Briefcase className="w-4 h-4 text-purple-600" />,
  SELLER_RESTAURANT: <UtensilsCrossed className="w-4 h-4 text-emerald-600" />,
  SELLER_HOTEL: <Building2 className="w-4 h-4 text-teal-600" />,
}

function getInitials(name?: string) {
  if (!name) return "U"
  const parts = name.trim().split(" ")
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function InAppSupportView({ role, panelTitle, panelSlug, className }: InAppSupportViewProps) {
  const [activeTab, setActiveTab] = useState<"chat" | "new">("chat")
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // New ticket form state
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [mobile, setMobile] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [isSubmittingNew, setIsSubmittingNew] = useState(false)
  const [newError, setNewError] = useState("")

  // Chat reply state
  const [replyText, setReplyText] = useState("")
  const [isSendingReply, setIsSendingReply] = useState(false)
  const [chatError, setChatError] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const markTicketAsRead = useCallback(async (ticketId: string) => {
    try {
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, unreadCount: 0 } : t))
      )
      await fetch(`/api/account/support-tickets/${ticketId}/read`, {
        method: "POST",
      })
    } catch (err) {
      console.warn("Failed to mark ticket as read:", err)
    }
  }, [])

  // Fetch tickets for current logged-in user
  const fetchTickets = useCallback(async (forcedSelectedId?: string, silent = false) => {
    try {
      if (!silent) setIsLoading(true)
      const res = await fetch("/api/account/support-tickets", {
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        const list: SupportTicket[] = data.tickets || []
        // Zero out unread for the currently active ticket (user is viewing it)
        setSelectedTicketId((prev) => {
          const currentId = forcedSelectedId || prev
          const normalizedList = list.map((t) =>
            t.id === currentId ? { ...t, unreadCount: 0 } : t
          )
          setTickets(normalizedList)

          if (list.length > 0) {
            if (forcedSelectedId) return forcedSelectedId
            if (prev && list.some((t) => t.id === prev)) return prev
            return list[0].id
          } else {
            setActiveTab("new")
            return null
          }
        })
      }
    } catch (err) {
      console.error("Failed to load user support tickets:", err)
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  // When active ticket changes or is viewed, mark it as read
  useEffect(() => {
    if (selectedTicketId && activeTab === "chat") {
      markTicketAsRead(selectedTicketId)
    }
  }, [selectedTicketId, activeTab, markTicketAsRead])

  // Live Auto-Sync: Poll for incoming messages from Admin every 3.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === "chat" && document.visibilityState === "visible" && !isSendingReply && !isSubmittingNew) {
        fetchTickets(undefined, true)
      }
    }, 3500)

    let lastFocusTime = 0
    const handleFocus = () => {
      const now = Date.now()
      if (activeTab === "chat" && now - lastFocusTime > 4000) {
        lastFocusTime = now
        fetchTickets(undefined, true)
      }
    }
    window.addEventListener("focus", handleFocus)

    return () => {
      clearInterval(interval)
      window.removeEventListener("focus", handleFocus)
    }
  }, [fetchTickets, activeTab, isSendingReply, isSubmittingNew])

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [selectedTicketId, tickets])

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId) || null

  // Submit new ticket
  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault()
    setNewError("")

    if (!message.trim() || message.trim().length < 5) {
      setNewError("Please write a detailed message (minimum 5 characters).")
      return
    }

    try {
      setIsSubmittingNew(true)
      const res = await fetch("/api/account/support-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName.trim(),
          email: email.trim(),
          mobile: mobile.trim(),
          userType: role,
          subject: subject.trim() || `${panelTitle} Inquiry`,
          message: message.trim(),
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Failed to create support ticket. Please try again.")
      }

      // Reset form
      setSubject("")
      setMessage("")
      
      // Refresh tickets list and switch to chat view with new ticket selected
      await fetchTickets(data.ticket?.id)
      if (data.ticket) {
        setSelectedTicketId(data.ticket.id)
      }
      setActiveTab("chat")
    } catch (err: any) {
      setNewError(err.message || "Failed to create support ticket.")
    } finally {
      setIsSubmittingNew(false)
    }
  }

  // Send message in active chat thread
  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!replyText.trim() || !selectedTicket) return

    setChatError("")
    setIsSendingReply(true)

    try {
      const res = await fetch(`/api/account/support-tickets/${selectedTicket.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: replyText.trim(),
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Failed to send message.")
      }

      setReplyText("")
      if (data.ticket) {
        // Preserve unreadCount: user just sent so count is 0; don't wipe from stale API response
        setTickets((prev) =>
          prev.map((t) =>
            t.id === selectedTicket.id
              ? { ...data.ticket, unreadCount: 0 }
              : t
          )
        )
      } else {
        fetchTickets(undefined, true)
      }
    } catch (err: any) {
      setChatError(err.message || "Failed to send message. Please try again.")
    } finally {
      setIsSendingReply(false)
    }
  }

  return (
    <div className={cn("space-y-6 max-w-6xl", className)}>
      
      {/* Header Banner */}
      <div className="rounded-3xl border border-indigo-200/80 bg-gradient-to-r from-blue-700 via-indigo-600 to-indigo-800 p-6 sm:p-8 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
              <LifeBuoy className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {panelTitle} Support Desk
              </h1>
              <p className="text-xs sm:text-sm text-indigo-100 mt-0.5">
                Chat with our support team, get assistance with your account, and track resolution.
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 bg-white/10 p-1 rounded-2xl border border-white/15 backdrop-blur-md self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
              activeTab === "chat"
                ? "bg-white text-indigo-900 shadow-md"
                : "text-indigo-100 hover:text-white hover:bg-white/10"
            )}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Existing Chats ({tickets.length})</span>
            {tickets.reduce((acc, t) => acc + (t.unreadCount || 0), 0) > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ml-0.5 animate-pulse">
                {tickets.reduce((acc, t) => acc + (t.unreadCount || 0), 0)} new
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("new")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
              activeTab === "new"
                ? "bg-white text-indigo-900 shadow-md"
                : "text-indigo-100 hover:text-white hover:bg-white/10"
            )}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
        </div>
      </div>

      {activeTab === "new" ? (
        /* Tab 1: Submit New Support Chat Form */
        <Card className="rounded-3xl border-slate-200/90 shadow-sm bg-white overflow-hidden">
          <CardHeader className="p-6 sm:p-8 bg-slate-50/70 border-b border-slate-100">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-xl font-bold text-slate-900">
                  Start a New Support Conversation
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-slate-600">
                  Describe your issue or question below. Our support team will assist you in this live message thread.
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-indigo-50 border-indigo-200 text-indigo-700 text-xs font-semibold shrink-0">
                {panelTitle}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleCreateTicket} className="space-y-5">
              
              <div className="space-y-1.5">
                <Label htmlFor="inapp-subject" className="text-xs font-semibold text-slate-700">
                  Topic / Subject (Optional)
                </Label>
                <Input
                  id="inapp-subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Question about order, payout, account update..."
                  className="h-11 rounded-xl text-sm border-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inapp-message" className="text-xs font-semibold text-slate-700">
                  Your Message <span className="text-rose-500">*</span>
                </Label>
                <Textarea
                  id="inapp-message"
                  required
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message or inquiry here..."
                  className="rounded-2xl text-sm border-slate-200 p-4 resize-y leading-relaxed"
                />
              </div>

              {newError && (
                <Alert variant="destructive" className="rounded-2xl border-rose-300 bg-rose-50 text-rose-900">
                  <AlertCircle className="w-4 h-4" />
                  <AlertTitle className="text-xs font-bold">Submission Error</AlertTitle>
                  <AlertDescription className="text-xs">{newError}</AlertDescription>
                </Alert>
              )}

              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={isSubmittingNew}
                  className="rounded-2xl px-8 h-11 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20"
                >
                  {isSubmittingNew ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Starting Chat...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Send className="w-4 h-4" />
                      <span>Start Support Chat</span>
                    </div>
                  )}
                </Button>

                {tickets.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveTab("chat")}
                    className="rounded-2xl px-5 h-11 text-sm font-semibold border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    Cancel & View Chat
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        /* Tab 2: Interactive Chat & Tickets Conversation */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Tickets Master List (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Your Tickets ({tickets.length})
              </span>
              <button
                type="button"
                onClick={() => fetchTickets()}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1"
                title="Refresh list"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                <span>Refresh</span>
              </button>
            </div>

            {isLoading ? (
              <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-500 text-xs">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <span>Loading tickets...</span>
              </div>
            ) : tickets.length === 0 ? (
              <Card className="rounded-3xl border-slate-200 bg-white p-6 text-center space-y-3">
                <Inbox className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-800">No support tickets yet</p>
                <Button
                  type="button"
                  onClick={() => setActiveTab("new")}
                  size="sm"
                  className="rounded-xl text-xs font-bold bg-indigo-600 text-white"
                >
                  Create Your First Ticket
                </Button>
              </Card>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {tickets.map((t) => {
                  const isSelected = t.id === selectedTicketId
                  const isPending = t.status === "PENDING"
                  const isResolved = t.status === "RESOLVED"
                  const isClosed = t.status === "CLOSED"
                  const hasUnread = Boolean(t.unreadCount && t.unreadCount > 0)

                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedTicketId(t.id)
                        markTicketAsRead(t.id)
                      }}
                      className={cn(
                        "w-full text-left p-4 rounded-2xl border transition-all space-y-2 relative",
                        isSelected
                          ? "border-indigo-600 bg-indigo-50/70 shadow-sm ring-1 ring-indigo-600"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] font-extrabold text-indigo-700">
                            {t.ticketId}
                          </span>
                          {hasUnread && (
                            <Badge className="bg-rose-600 text-white font-extrabold text-[9px] px-1.5 py-0 border-0 shadow-xs animate-pulse">
                              {t.unreadCount} new
                            </Badge>
                          )}
                        </div>

                        {isPending ? (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-semibold">
                            Pending
                          </Badge>
                        ) : isResolved ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-semibold">
                            Resolved
                          </Badge>
                        ) : isClosed ? (
                          <Badge className="bg-slate-100 text-slate-700 border-slate-300 text-[10px] font-semibold">
                            Closed
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-[10px] font-semibold">
                            In Progress
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs font-bold text-slate-900 truncate">
                        {t.subject || "Support Inquiry"}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>{((t.replies?.length ?? 0) + 1)} messages</span>
                        <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right Column: Chat Conversation Thread (8 cols) */}
          <div className="lg:col-span-8">
            {selectedTicket ? (
              <Card className="rounded-3xl border-slate-200/90 shadow-sm bg-white overflow-hidden flex flex-col h-[650px]">
                
                {/* Chat Header with Official Agent DP */}
                <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/90 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold shadow-xs shrink-0 relative">
                      <Headphones className="w-5 h-5 text-emerald-400" />
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" title="Support Online" />
                    </div>

                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-slate-900 truncate">
                          MEEEM Support Desk
                        </h2>
                        {selectedTicket.status === "PENDING" ? (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-semibold">
                            Pending
                          </Badge>
                        ) : selectedTicket.status === "RESOLVED" ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-semibold">
                            Resolved
                          </Badge>
                        ) : selectedTicket.status === "CLOSED" ? (
                          <Badge className="bg-slate-100 text-slate-700 border-slate-300 text-[10px] font-semibold">
                            Closed
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-[10px] font-semibold">
                            In Progress
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-medium truncate">
                        <span className="font-mono text-indigo-700 font-bold mr-1.5">{selectedTicket.ticketId}</span>
                        <span>{selectedTicket.subject || "Support Inquiry"}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 text-right shrink-0">
                    <span>Started: {new Date(selectedTicket.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Messages Scroll Area (WhatsApp feel) */}
                <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-100/70">
                  {(!selectedTicket.replies || selectedTicket.replies.length === 0) ? (
                    /* Initial Ticket Message Fallback */
                    <div className="flex items-end justify-end gap-2.5">
                      <div className="flex flex-col items-end max-w-md sm:max-w-lg">
                        <div className="rounded-2xl rounded-tr-xs bg-indigo-600 text-white p-4 shadow-xs space-y-1">
                          <p className="text-xs font-bold text-indigo-100">
                            {selectedTicket.name || "You"}
                          </p>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {selectedTicket.message}
                          </p>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 px-1">
                          {new Date(selectedTicket.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      {/* User DP Avatar */}
                      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs mb-5">
                        {getInitials(selectedTicket.name || "You")}
                      </div>
                    </div>
                  ) : (
                    /* Thread Replies */
                    selectedTicket.replies.map((rep, idx) => {
                      const isAdmin = rep.senderType === "ADMIN"

                      return (
                        <div
                          key={rep.id || idx}
                          className={cn("flex items-end gap-2.5", isAdmin ? "justify-start" : "justify-end")}
                        >
                          {/* Admin Avatar on Left for Agent Replies */}
                          {isAdmin && (
                            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs mb-5">
                              <Headphones className="w-4 h-4 text-emerald-400" />
                            </div>
                          )}

                          <div className={cn("flex flex-col max-w-md sm:max-w-lg", isAdmin ? "items-start" : "items-end")}>
                            <div
                              className={cn(
                                "rounded-2xl p-4 shadow-xs space-y-1.5",
                                isAdmin
                                  ? "rounded-tl-xs bg-white border border-slate-200/90 text-slate-800"
                                  : "rounded-tr-xs bg-indigo-600 text-white"
                              )}
                            >
                              <div className="flex items-center gap-1.5 text-xs font-bold">
                                {isAdmin ? (
                                  <>
                                    <span className="text-indigo-600">MEEEM Support Team</span>
                                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[9px] px-1.5 py-0 font-bold">
                                      Official Agent
                                    </Badge>
                                  </>
                                ) : (
                                  <span className="text-indigo-100">{rep.senderName || "You"}</span>
                                )}
                              </div>

                              <p className={cn("text-sm leading-relaxed whitespace-pre-wrap", isAdmin ? "text-slate-800" : "text-white")}>
                                {rep.message}
                              </p>
                            </div>

                            {/* Timestamp & Status Checkmark */}
                            <div className={cn("flex items-center gap-1 text-[10px] text-slate-400 mt-1 px-1", isAdmin ? "justify-start" : "justify-end")}>
                              <span>{new Date(rep.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                              {!isAdmin && (
                                <span title="Sent to Support">
                                  <CheckCheck className="w-3.5 h-3.5 text-indigo-600 inline" />
                                </span>
                              )}
                            </div>
                          </div>

                          {/* User Avatar on Right for User Messages */}
                          {!isAdmin && (
                            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs mb-5">
                              {getInitials(rep.senderName || selectedTicket.name || "You")}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Chat Message Input Footer or Resolved Lock Notice */}
                <div className="p-3 sm:p-4 border-t border-slate-200 bg-white shrink-0">
                  {selectedTicket.status === "RESOLVED" || selectedTicket.status === "CLOSED" ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                      <div className="flex items-center gap-2 text-slate-700">
                        <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>This support ticket has been marked as <strong>Resolved</strong>. No further messages are allowed.</span>
                      </div>
                      <Button
                        type="button"
                        onClick={() => setActiveTab("new")}
                        size="sm"
                        className="rounded-xl px-3.5 h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                      >
                        <PlusCircle className="w-3.5 h-3.5 mr-1" />
                        <span>Open New Ticket</span>
                      </Button>
                    </div>
                  ) : (
                    <>
                      {chatError && (
                        <p className="text-xs text-rose-600 mb-2 font-medium">{chatError}</p>
                      )}
                      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                        <Input
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Type a follow-up message to support (unlimited messages)..."
                          className="h-11 rounded-2xl text-sm border-slate-200 focus:border-indigo-400"
                        />
                        <Button
                          type="submit"
                          disabled={isSendingReply || !replyText.trim()}
                          className="rounded-2xl px-5 h-11 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 shadow-md shadow-indigo-600/20"
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
                      </form>
                    </>
                  )}
                </div>

              </Card>
            ) : (
              <div className="h-[400px] flex items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 text-slate-500 text-xs">
                Select a ticket from the left to view the conversation thread.
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  )
}
