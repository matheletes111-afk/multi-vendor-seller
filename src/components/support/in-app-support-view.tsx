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
  ShieldCheck,
  Check,
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
}

const ROLE_ICONS: Record<PanelRole, React.ReactNode> = {
  CUSTOMER: <ShoppingBag className="w-4 h-4 text-indigo-600" />,
  SELLER_PRODUCT: <Store className="w-4 h-4 text-blue-600" />,
  SELLER_SERVICE: <Briefcase className="w-4 h-4 text-purple-600" />,
  SELLER_RESTAURANT: <UtensilsCrossed className="w-4 h-4 text-emerald-600" />,
  SELLER_HOTEL: <Building2 className="w-4 h-4 text-teal-600" />,
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

  // Fetch tickets for current logged-in user
  const fetchTickets = useCallback(async (autoSelectFirst = false) => {
    try {
      setIsLoading(true)
      const res = await fetch("/api/account/support-tickets")
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        const list: SupportTicket[] = data.tickets || []
        setTickets(list)
        if (list.length > 0) {
          if (autoSelectFirst || !selectedTicketId) {
            setSelectedTicketId(list[0].id)
          }
        } else {
          setActiveTab("new")
        }
      }
    } catch (err) {
      console.error("Failed to load user support tickets:", err)
    } finally {
      setIsLoading(false)
    }
  }, [selectedTicketId])

  useEffect(() => {
    fetchTickets(true)
  }, [fetchTickets])

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
      await fetchTickets(false)
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
        setTickets((prev) =>
          prev.map((t) => (t.id === selectedTicket.id ? data.ticket : t))
        )
      } else {
        fetchTickets(false)
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

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 self-start md:self-center bg-white/10 backdrop-blur-md p-1 rounded-2xl border border-white/20">
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
            <span>Support Chat & Tickets ({tickets.length})</span>
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
            <span>New Ticket</span>
          </button>
        </div>
      </div>

      {activeTab === "new" ? (
        /* Tab 1: Submit New Support Ticket Form */
        <Card className="rounded-3xl border-slate-200/90 shadow-sm bg-white overflow-hidden">
          <CardHeader className="p-6 sm:p-8 bg-slate-50/70 border-b border-slate-100">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-xl font-bold text-slate-900">
                  Open a New Support Ticket
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-slate-600">
                  Submit your question or issue. A support agent will respond directly in your chat thread.
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-indigo-50 border-indigo-200 text-indigo-700 text-xs font-semibold shrink-0">
                {panelTitle}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleCreateTicket} className="space-y-6">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="inapp-name" className="text-xs font-semibold text-slate-700">
                    Your Name
                  </Label>
                  <Input
                    id="inapp-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your name"
                    className="h-10 rounded-xl text-sm border-slate-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inapp-email" className="text-xs font-semibold text-slate-700">
                    Email Address
                  </Label>
                  <Input
                    id="inapp-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="h-10 rounded-xl text-sm border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="inapp-mobile" className="text-xs font-semibold text-slate-700">
                    Mobile Number
                  </Label>
                  <Input
                    id="inapp-mobile"
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="+232 XX XXXXXX"
                    className="h-10 rounded-xl text-sm border-slate-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inapp-subject" className="text-xs font-semibold text-slate-700">
                    Subject / Topic <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="inapp-subject"
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Issue with payout / Order inquiry / Account update"
                    className="h-10 rounded-xl text-sm border-slate-200"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inapp-message" className="text-xs font-semibold text-slate-700">
                  Message / Details <span className="text-rose-500">*</span>
                </Label>
                <Textarea
                  id="inapp-message"
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your issue or question in detail..."
                  className="rounded-2xl text-sm border-slate-200 p-3.5 resize-y"
                />
              </div>

              {newError && (
                <Alert variant="destructive" className="rounded-2xl border-rose-300 bg-rose-50 text-rose-900">
                  <AlertCircle className="w-4 h-4" />
                  <AlertTitle className="text-xs font-bold">Submission Error</AlertTitle>
                  <AlertDescription className="text-xs">{newError}</AlertDescription>
                </Alert>
              )}

              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  disabled={isSubmittingNew}
                  className="rounded-2xl px-6 h-11 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20"
                >
                  {isSubmittingNew ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Submitting...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Send className="w-4 h-4" />
                      <span>Create Support Ticket</span>
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
                onClick={() => fetchTickets(false)}
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

                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTicketId(t.id)}
                      className={cn(
                        "w-full text-left p-4 rounded-2xl border transition-all space-y-2",
                        isSelected
                          ? "border-indigo-600 bg-indigo-50/70 shadow-sm ring-1 ring-indigo-600"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-extrabold text-indigo-700">
                          {t.ticketId}
                        </span>
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
                        <span>{t.replies?.length || 1} messages</span>
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
                
                {/* Chat Header */}
                <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3 shrink-0">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-200">
                        {selectedTicket.ticketId}
                      </span>
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
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {selectedTicket.subject || "Support Inquiry"}
                    </p>
                  </div>

                  <div className="text-[11px] text-slate-400 text-right shrink-0">
                    <span>Started: {new Date(selectedTicket.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Messages Scroll Area */}
                <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-50/30">
                  {/* Initial Ticket Message */}
                  <div className="flex flex-col items-end">
                    <div className="max-w-md sm:max-w-lg rounded-2xl rounded-tr-xs bg-indigo-600 text-white p-4 shadow-sm space-y-1">
                      <p className="text-xs font-bold text-indigo-100">
                        {selectedTicket.name || "You"}
                      </p>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {selectedTicket.message}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 mr-1">
                      {new Date(selectedTicket.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  {/* Thread Replies */}
                  {selectedTicket.replies?.map((rep, idx) => {
                    const isAdmin = rep.senderType === "ADMIN"

                    return (
                      <div
                        key={rep.id || idx}
                        className={cn("flex flex-col", isAdmin ? "items-start" : "items-end")}
                      >
                        <div
                          className={cn(
                            "max-w-md sm:max-w-lg rounded-2xl p-4 shadow-sm space-y-1",
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
                                  Agent
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

                        <span className="text-[10px] text-slate-400 mt-1 px-1">
                          {new Date(rep.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    )
                  })}
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
