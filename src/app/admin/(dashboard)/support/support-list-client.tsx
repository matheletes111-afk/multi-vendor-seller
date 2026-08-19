"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  LifeBuoy,
  Search,
  RefreshCw,
  Mail,
  Phone,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  Store,
  Briefcase,
  UtensilsCrossed,
  Building2,
  ArrowRight,
  Filter,
  Inbox,
  MessageSquare,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Badge } from "@/ui/badge"
import { cn } from "@/lib/utils"

interface SupportTicketSummary {
  id: string
  ticketId: string
  userType: "CUSTOMER" | "SELLER_PRODUCT" | "SELLER_SERVICE" | "SELLER_RESTAURANT" | "SELLER_HOTEL"
  name: string
  email: string
  mobile: string
  subject?: string | null
  message: string
  status: "PENDING" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "OPEN"
  createdAt: string
  replies?: Array<{ id: string; createdAt: string }>
}

interface Stats {
  total: number
  open: number
  inProgress: number
  closed: number
}

const USER_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  CUSTOMER: {
    label: "Customer",
    icon: <ShoppingBag className="w-3.5 h-3.5" />,
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  SELLER_PRODUCT: {
    label: "Product Seller",
    icon: <Store className="w-3.5 h-3.5" />,
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  SELLER_SERVICE: {
    label: "Service Provider",
    icon: <Briefcase className="w-3.5 h-3.5" />,
    color: "bg-purple-50 text-purple-700 border-purple-200",
  },
  SELLER_RESTAURANT: {
    label: "Restaurant Partner",
    icon: <UtensilsCrossed className="w-3.5 h-3.5" />,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  SELLER_HOTEL: {
    label: "Hotel Host",
    icon: <Building2 className="w-3.5 h-3.5" />,
    color: "bg-teal-50 text-teal-700 border-teal-200",
  },
}

export function AdminSupportListClient() {
  const [tickets, setTickets] = useState<SupportTicketSummary[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, open: 0, inProgress: 0, closed: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [userTypeFilter, setUserTypeFilter] = useState("ALL")

  const fetchTickets = useCallback(async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== "ALL") params.set("status", statusFilter)
      if (userTypeFilter !== "ALL") params.set("userType", userTypeFilter)
      if (searchQuery.trim()) params.set("query", searchQuery.trim())

      const res = await fetch(`/api/admin/support?${params.toString()}`)
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setTickets(data.tickets || [])
        setStats(data.stats || { total: 0, open: 0, inProgress: 0, closed: 0 })
      }
    } catch (err) {
      console.error("Failed to load support tickets:", err)
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter, userTypeFilter, searchQuery])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  return (
    <div className="container mx-auto py-8 max-w-7xl space-y-8 px-4 sm:px-6">
      
      {/* Header Banner */}
      <div className="rounded-3xl border border-indigo-200/80 bg-gradient-to-r from-blue-700 via-indigo-600 to-indigo-800 p-6 sm:p-8 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
              <LifeBuoy className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Customer & Seller Support Hub
              </h1>
              <p className="text-xs sm:text-sm text-indigo-100 mt-0.5">
                Manage in-app customer & seller chat conversations, public inquiries, email replies, and ticket statuses.
              </p>
            </div>
          </div>
        </div>

        <Button
          type="button"
          onClick={fetchTickets}
          variant="outline"
          className="rounded-2xl border-white/20 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md self-start md:self-center"
        >
          <RefreshCw className={cn("w-3.5 h-3.5 mr-2", isLoading && "animate-spin")} />
          <span>Refresh Tickets</span>
        </Button>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
            Total Tickets
          </span>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            {stats.total}
          </p>
        </Card>

        <Card className="rounded-2xl border-amber-200 bg-amber-50/50 p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700 block">
            Pending Action
          </span>
          <p className="text-2xl sm:text-3xl font-extrabold text-amber-900 mt-1">
            {stats.open}
          </p>
        </Card>

        <Card className="rounded-2xl border-blue-200 bg-blue-50/50 p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700 block">
            In Progress
          </span>
          <p className="text-2xl sm:text-3xl font-extrabold text-blue-900 mt-1">
            {stats.inProgress}
          </p>
        </Card>

        <Card className="rounded-2xl border-emerald-200 bg-emerald-50/50 p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 block">
            Resolved / Closed
          </span>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-900 mt-1">
            {stats.closed}
          </p>
        </Card>
      </div>

      {/* Filters & Search Toolbar */}
      <Card className="rounded-3xl border-slate-200/90 shadow-sm bg-white p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Ticket ID, name, email, mobile, subject..."
              className="pl-10 h-10 rounded-xl text-xs sm:text-sm border-slate-200"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>

          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "ALL", label: "All Statuses" },
              { id: "PENDING", label: "Pending" },
              { id: "IN_PROGRESS", label: "In Progress" },
              { id: "RESOLVED", label: "Resolved" },
              { id: "CLOSED", label: "Closed" },
            ].map((st) => {
              const isActive = statusFilter === st.id
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatusFilter(st.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {st.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* User Type Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            <span>User Role:</span>
          </span>
          {[
            { id: "ALL", label: "All Roles" },
            { id: "CUSTOMER", label: "Customer" },
            { id: "SELLER_PRODUCT", label: "Product Seller" },
            { id: "SELLER_SERVICE", label: "Service Provider" },
            { id: "SELLER_RESTAURANT", label: "Restaurant" },
            { id: "SELLER_HOTEL", label: "Hotel" },
          ].map((role) => {
            const isSelected = userTypeFilter === role.id
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => setUserTypeFilter(role.id)}
                className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-indigo-100 text-indigo-900 font-bold border border-indigo-300"
                    : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                {role.label}
              </button>
            )
          })}
        </div>
      </Card>

      {/* Tickets List Table */}
      <Card className="rounded-3xl border-slate-200/90 shadow-sm bg-white overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-slate-500 space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-medium">Loading support tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-3">
            <Inbox className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No support tickets found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No support tickets matched your current search and filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Ticket ID</th>
                  <th className="px-6 py-4">User Role</th>
                  <th className="px-6 py-4">Requester</th>
                  <th className="px-6 py-4">Subject & Message</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Submitted</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map((ticket) => {
                  const roleMeta = USER_TYPE_LABELS[ticket.userType] || USER_TYPE_LABELS.CUSTOMER
                  const isPending = ticket.status === "PENDING" || ticket.status === "OPEN"
                  const isResolved = ticket.status === "RESOLVED"
                  const isClosed = ticket.status === "CLOSED"

                  return (
                    <tr key={ticket.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Ticket ID */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                          {ticket.ticketId}
                        </span>
                      </td>

                      {/* User Type */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant="outline" className={`inline-flex items-center gap-1.5 text-xs font-medium ${roleMeta.color}`}>
                          {roleMeta.icon}
                          <span>{roleMeta.label}</span>
                        </Badge>
                      </td>

                      {/* Requester Contact */}
                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-900 text-xs sm:text-sm">
                            {ticket.name}
                          </p>
                          <p className="text-xs text-slate-500 font-mono">
                            {ticket.email}
                          </p>
                          <p className="text-xs text-slate-400 font-mono">
                            {ticket.mobile}
                          </p>
                        </div>
                      </td>

                      {/* Subject & Preview */}
                      <td className="px-6 py-4 max-w-xs">
                        <p className="font-semibold text-slate-900 text-xs truncate">
                          {ticket.subject || "Support Inquiry"}
                        </p>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                          {ticket.message}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
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
                      </td>

                      {/* Date */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                        {new Date(ticket.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Button
                          asChild
                          size="sm"
                          className="rounded-xl px-3.5 h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                        >
                          <Link href={`/admin/support/${ticket.id}`}>
                            <MessageSquare className="w-3.5 h-3.5 mr-1" />
                            <span>Chat & Reply</span>
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

    </div>
  )
}
