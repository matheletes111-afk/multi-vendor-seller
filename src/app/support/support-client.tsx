"use client"

import React, { useState } from "react"
import {
  LifeBuoy,
  Mail,
  Phone,
  Clock,
  Send,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  User,
  ShoppingBag,
  Store,
  Briefcase,
  UtensilsCrossed,
  Building2,
  FileText,
  ShieldCheck,
  HelpCircle,
  ArrowRight,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Textarea } from "@/ui/textarea"
import { Label } from "@/ui/label"
import { Badge } from "@/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/ui/alert"
import Link from "next/link"

type SupportUserType = "CUSTOMER" | "SELLER_PRODUCT" | "SELLER_SERVICE" | "SELLER_RESTAURANT" | "SELLER_HOTEL"

interface UserTypeOption {
  id: SupportUserType
  title: string
  subtitle: string
  icon: React.ReactNode
  color: string
}

const USER_TYPES: UserTypeOption[] = [
  {
    id: "CUSTOMER",
    title: "Customer / Buyer",
    subtitle: "Orders, deliveries, payments, account access",
    icon: <ShoppingBag className="w-5 h-5 text-indigo-600" />,
    color: "border-indigo-200 bg-indigo-50/50 text-indigo-900",
  },
  {
    id: "SELLER_PRODUCT",
    title: "Product Seller",
    subtitle: "Store listings, payouts, inventory, orders",
    icon: <Store className="w-5 h-5 text-blue-600" />,
    color: "border-blue-200 bg-blue-50/50 text-blue-900",
  },
  {
    id: "SELLER_SERVICE",
    title: "Service Provider",
    subtitle: "Service bookings, scheduling, appointments",
    icon: <Briefcase className="w-5 h-5 text-purple-600" />,
    color: "border-purple-200 bg-purple-50/50 text-purple-900",
  },
  {
    id: "SELLER_RESTAURANT",
    title: "Restaurant Partner",
    subtitle: "Menu items, food orders, delivery coordination",
    icon: <UtensilsCrossed className="w-5 h-5 text-emerald-600" />,
    color: "border-emerald-200 bg-emerald-50/50 text-emerald-900",
  },
  {
    id: "SELLER_HOTEL",
    title: "Hotel Host",
    subtitle: "Room reservations, guest check-ins, availability",
    icon: <Building2 className="w-5 h-5 text-teal-600" />,
    color: "border-teal-200 bg-teal-50/50 text-teal-900",
  },
]

export function SupportPortalClient() {
  const [userType, setUserType] = useState<SupportUserType>("CUSTOMER")
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [mobile, setMobile] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [ticketId, setTicketId] = useState<string | null>(null)
  const [copiedTicketId, setCopiedTicketId] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage("")

    if (!fullName.trim()) {
      setErrorMessage("Please enter your full name.")
      return
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMessage("Please enter a valid email address.")
      return
    }
    if (!mobile.trim()) {
      setErrorMessage("Please enter your mobile phone number.")
      return
    }
    if (!message.trim() || message.trim().length < 5) {
      setErrorMessage("Please provide a detailed inquiry message (minimum 5 characters).")
      return
    }

    try {
      setIsSubmitting(true)
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName.trim(),
          email: email.trim(),
          mobile: mobile.trim(),
          userType,
          subject: subject.trim() || "General Support Inquiry",
          message: message.trim(),
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit support request. Please try again.")
      }

      setTicketId(data.ticketId || `TICK-${Date.now().toString(36).toUpperCase()}`)
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred. Please try again or email support@meeemsl.com.")
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleReset() {
    setTicketId(null)
    setFullName("")
    setEmail("")
    setMobile("")
    setSubject("")
    setMessage("")
    setErrorMessage("")
  }

  const copyTicketId = () => {
    if (!ticketId) return
    navigator.clipboard.writeText(ticketId)
    setCopiedTicketId(true)
    setTimeout(() => setCopiedTicketId(false), 2000)
  }

  return (
    <div className="min-h-screen bg-slate-50/70 py-6 sm:py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">

        {/* Hero Section */}
        <div className="rounded-3xl border border-indigo-200/80 bg-gradient-to-r from-blue-700 via-indigo-600 to-indigo-800 p-6 sm:p-8 text-white shadow-md">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-bold uppercase tracking-wider text-indigo-100">
                <LifeBuoy className="w-4 h-4 text-indigo-200" />
                <span>MEEEM Marketplace Helpdesk</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
                How can we help you today?
              </h1>
              <p className="text-base text-indigo-100 leading-relaxed">
                Whether you are a customer, vendor, service provider, restaurant partner, or hotel host, our dedicated support team is here to assist you.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0 w-full sm:w-auto">
              <div className="flex items-center gap-2 text-xs font-semibold bg-white/10 px-4 py-2.5 rounded-2xl border border-white/15">
                <Mail className="w-4 h-4 text-indigo-200 shrink-0" />
                <span>support@meeemsl.com</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold bg-white/10 px-4 py-2.5 rounded-2xl border border-white/15">
                <Clock className="w-4 h-4 text-indigo-200 shrink-0" />
                <span>Response in 24–48 Hours</span>
              </div>
            </div>
          </div>
        </div>

        {ticketId ? (
          /* Submission Success View */
          <Card className="rounded-3xl border-emerald-200 bg-white shadow-sm p-8 sm:p-12 text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-md shadow-emerald-100">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2 max-w-lg mx-auto">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                Support Request Received!
              </h2>
              <p className="text-base text-slate-600 leading-relaxed">
                Thank you for reaching out. Your inquiry has been routed to our support team and an agent will reply to your email directly.
              </p>
            </div>

            {/* Ticket ID Box */}
            <div className="max-w-md mx-auto rounded-2xl bg-slate-50 border border-slate-200 p-5 space-y-2 text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Your Support Ticket Reference ID
              </span>
              <div className="flex items-center justify-center gap-3">
                <span className="font-mono text-xl sm:text-2xl font-extrabold text-indigo-600">
                  {ticketId}
                </span>
                <button
                  type="button"
                  onClick={copyTicketId}
                  className="p-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 shadow-sm transition-all"
                  title="Copy Ticket ID"
                >
                  {copiedTicketId ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
              <Button
                type="button"
                onClick={handleReset}
                className="rounded-2xl px-6 h-11 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20"
              >
                Submit Another Request
              </Button>
              <Button asChild variant="outline" className="rounded-2xl px-6 h-11 text-sm font-semibold border-slate-300 text-slate-700 hover:bg-slate-50">
                <Link href="/">Back to Home</Link>
              </Button>
            </div>
          </Card>
        ) : (
          /* Main Support Inquiry Form */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Inquiry Form (8 cols) */}
            <div className="lg:col-span-8">
              <Card className="rounded-3xl border-slate-200/90 shadow-sm bg-white overflow-hidden">
                <CardHeader className="p-6 sm:p-8 bg-slate-50/60 border-b border-slate-100 space-y-1.5">
                  <CardTitle className="text-xl sm:text-2xl font-bold text-slate-900">
                    Submit a Support Request
                  </CardTitle>
                  <CardDescription className="text-sm text-slate-600 leading-relaxed">
                    Fill out the form below with your account details and inquiry. Our team will review and respond via email.
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-6 sm:p-8">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    
                    {/* 1. User Type Selector (Customer + 4 Sellers) */}
                    <div className="space-y-3">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                        Select Your Account Type <span className="text-rose-500">*</span>
                      </Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {USER_TYPES.map((type) => {
                          const isSelected = userType === type.id
                          return (
                            <button
                              key={type.id}
                              type="button"
                              onClick={() => setUserType(type.id)}
                              className={`p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 ${
                                isSelected
                                  ? "border-indigo-600 bg-indigo-50/70 shadow-sm ring-1 ring-indigo-600"
                                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
                              }`}
                            >
                              <div className="p-2 rounded-xl bg-white shadow-xs border border-slate-200/60 shrink-0">
                                {type.icon}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-slate-900 truncate">
                                  {type.title}
                                </p>
                                <p className="text-xs text-slate-500 truncate">
                                  {type.subtitle}
                                </p>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* 2. Basic Contact Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="support-name" className="text-xs font-semibold text-slate-700">
                          Full Name <span className="text-rose-500">*</span>
                        </Label>
                        <Input
                          id="support-name"
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g. Jane Doe"
                          className="h-11 rounded-xl text-sm border-slate-200"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="support-email" className="text-xs font-semibold text-slate-700">
                          Email Address <span className="text-rose-500">*</span>
                        </Label>
                        <Input
                          id="support-email"
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@example.com"
                          className="h-11 rounded-xl text-sm border-slate-200"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="support-mobile" className="text-xs font-semibold text-slate-700">
                          Mobile / Phone Number <span className="text-rose-500">*</span>
                        </Label>
                        <Input
                          id="support-mobile"
                          type="tel"
                          required
                          value={mobile}
                          onChange={(e) => setMobile(e.target.value)}
                          placeholder="+232 XX XXXXXX"
                          className="h-11 rounded-xl text-sm border-slate-200"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="support-subject" className="text-xs font-semibold text-slate-700">
                          Subject / Topic
                        </Label>
                        <Input
                          id="support-subject"
                          type="text"
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          placeholder="e.g. Question about order #1234 / Payout status"
                          className="h-11 rounded-xl text-sm border-slate-200"
                        />
                      </div>
                    </div>

                    {/* 3. Inquiry Message Textarea */}
                    <div className="space-y-1.5">
                      <Label htmlFor="support-message" className="text-xs font-semibold text-slate-700">
                        Inquiry / Message <span className="text-rose-500">*</span>
                      </Label>
                      <Textarea
                        id="support-message"
                        required
                        rows={5}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Please describe your issue, question, or request in detail..."
                        className="rounded-2xl text-sm border-slate-200 resize-y p-3.5"
                      />
                    </div>

                    {errorMessage && (
                      <Alert variant="destructive" className="rounded-2xl border-rose-300 bg-rose-50 text-rose-900">
                        <AlertCircle className="w-4 h-4" />
                        <AlertTitle className="text-xs font-bold">Unable to submit request</AlertTitle>
                        <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
                      </Alert>
                    )}

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full sm:w-auto rounded-2xl px-8 h-11 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20"
                    >
                      {isSubmitting ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Submitting Request...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Send className="w-4 h-4" />
                          <span>Submit Support Inquiry</span>
                        </div>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Help Info & Helpful Links (4 cols) */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Direct Support Contacts */}
              <Card className="rounded-3xl border-slate-200/90 shadow-sm bg-white p-6 space-y-4">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-base">
                  <Mail className="w-5 h-5 text-indigo-600" />
                  <span>Direct Contact</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  For urgent inquiries or official regulatory matters, you may email our team directly:
                </p>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                    Support Email
                  </span>
                  <a href="mailto:support@meeemsl.com" className="text-sm font-mono font-bold text-indigo-600 hover:underline">
                    support@meeemsl.com
                  </a>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                    General Inquiries
                  </span>
                  <a href="mailto:info@meeemsl.com" className="text-sm font-mono font-bold text-indigo-600 hover:underline">
                    info@meeemsl.com
                  </a>
                </div>
              </Card>

              {/* Policy & Account Actions */}
              <Card className="rounded-3xl border-slate-200/90 shadow-sm bg-white p-6 space-y-4">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-base">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <span>Policies & Account Requests</span>
                </div>

                <div className="space-y-2">
                  <Link
                    href="/terms"
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 hover:bg-slate-50 text-xs font-semibold text-slate-800 transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      <span>Legal Terms & Policies</span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </Link>

                  <Link
                    href="/delete-account"
                    className="flex items-center justify-between p-3 rounded-xl border border-rose-200/80 bg-rose-50/40 hover:bg-rose-50 text-xs font-semibold text-rose-800 transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <LifeBuoy className="w-4 h-4 text-rose-600" />
                      <span>Delete Account Request</span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-rose-400" />
                  </Link>
                </div>
              </Card>

            </div>

          </div>
        )}

      </div>
    </div>
  )
}
