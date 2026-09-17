"use client"

import React, { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { PublicLayout } from "@/components/site-layout"
import {
  RIDER_TERMS_AND_CONDITIONS,
  RIDER_PRIVACY_POLICY,
  RiderLegalDocument,
} from "@/lib/rider-terms-data"
import {
  Bike,
  Scale,
  ShieldCheck,
  Search,
  Copy,
  Check,
  Printer,
  ExternalLink,
  ChevronRight,
  ArrowRight,
  MapPin,
  Clock,
  Wallet,
  Smartphone,
  Lock,
  PhoneCall,
  UserCheck,
  Info,
  CheckCircle2,
  FileText,
  Sparkles,
  BookOpen,
  EyeOff,
} from "lucide-react"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Card, CardContent } from "@/ui/card"
import { cn } from "@/lib/utils"

export function RiderTermsClient() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const tabParam = searchParams.get("tab") || "terms"
  const isEmbed = searchParams.get("embed") === "true"

  const [activeTab, setActiveTab] = useState<"terms" | "privacy">(() => {
    if (tabParam === "privacy" || tabParam === "privacy-policy") return "privacy"
    return "terms"
  })

  const [searchQuery, setSearchQuery] = useState("")
  const [copied, setCopied] = useState(false)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)

  // Sync tab state with URL parameter
  useEffect(() => {
    if (tabParam === "privacy" || tabParam === "privacy-policy") {
      setActiveTab("privacy")
    } else if (tabParam === "terms" || tabParam === "terms-and-conditions") {
      setActiveTab("terms")
    }
  }, [tabParam])

  const handleTabChange = (tab: "terms" | "privacy") => {
    setActiveTab(tab)
    setSearchQuery("")
    const current = new URLSearchParams(Array.from(searchParams.entries()))
    current.set("tab", tab)
    const search = current.toString()
    const query = search ? `?${search}` : ""
    router.replace(`/rider-terms${query}`, { scroll: false })
  }

  const currentDoc: RiderLegalDocument =
    activeTab === "terms" ? RIDER_TERMS_AND_CONDITIONS : RIDER_PRIVACY_POLICY

  // Filter sections by search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return currentDoc.sections
    const q = searchQuery.toLowerCase().trim()
    return currentDoc.sections.filter((s) => {
      const matchTitle = s.title.toLowerCase().includes(q)
      const matchSummary = s.summary?.toLowerCase().includes(q) || false
      const matchContent = s.content.toLowerCase().includes(q)
      const matchBullets = s.bullets?.some((b) => b.toLowerCase().includes(q)) || false
      return matchTitle || matchSummary || matchContent || matchBullets
    })
  }, [currentDoc, searchQuery])

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(currentDoc.rawText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch (err) {
      console.error("Failed to copy text", err)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const scrollToSection = (id: string) => {
    setActiveSectionId(id)
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  const content = (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-50 to-blue-50/30 py-6 sm:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Hero Header Card */}
        <div className="relative overflow-hidden rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-10">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 border border-blue-200/70 shadow-2xs">
                  <Bike className="w-3.5 h-3.5 text-blue-600" />
                  MEEEM Delivery Partner Network
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200/70">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Official Legal Version 1.0
                </span>
                <span className="text-xs text-slate-500 hidden sm:inline">
                  Updated: September 2026
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900">
                Delivery Partner Legal &amp; Privacy Center
              </h1>

              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Clear, transparent guidelines for our courier network. Review independent contractor terms, 100% tip guarantees, weekly settlements, road safety compliance, and background location tracking disclosures.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/riderapp/login"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all"
                >
                  <Bike className="w-4 h-4" />
                  <span>Rider Portal Login</span>
                </Link>
                <Link
                  href="/riderapp/registration"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors"
                >
                  <span>Register as Delivery Rider</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Link
                  href="/terms"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-600 hover:text-slate-900 text-xs font-medium transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                  <span>All Platform Terms</span>
                </Link>
              </div>
            </div>

            {/* Quick Actions Card on Right */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 p-4 rounded-2xl bg-slate-50 border border-slate-200/70 shrink-0 sm:self-start lg:w-64">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                Document Tools
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyText}
                className="justify-start gap-2 h-9 rounded-xl bg-white hover:bg-slate-100 border-slate-200 text-xs font-medium text-slate-700"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700 font-semibold">Copied Full Text!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-500" />
                    <span>Copy Document Text</span>
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="justify-start gap-2 h-9 rounded-xl bg-white hover:bg-slate-100 border-slate-200 text-xs font-medium text-slate-700"
              >
                <Printer className="w-4 h-4 text-slate-500" />
                <span>Print Policy</span>
              </Button>
              <a
                href="/mobileapi/rider/terms"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-start gap-2 h-9 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-slate-500" />
                <span>Developer JSON API</span>
              </a>
            </div>
          </div>
        </div>

        {/* 4 Feature Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {currentDoc.highlights.map((h, i) => {
            const Icon =
              h.icon === "Wallet"
                ? Wallet
                : h.icon === "Clock"
                ? Clock
                : h.icon === "ShieldCheck"
                ? ShieldCheck
                : h.icon === "Smartphone"
                ? Smartphone
                : h.icon === "MapPin"
                ? MapPin
                : h.icon === "Lock"
                ? Lock
                : h.icon === "EyeOff"
                ? EyeOff
                : h.icon === "CheckCircle2"
                ? CheckCircle2
                : h.icon === "FileText"
                ? FileText
                : h.icon === "PhoneCall"
                ? PhoneCall
                : UserCheck

            return (
              <div
                key={i}
                className="flex items-start gap-3.5 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-sm hover:border-blue-200 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-900 leading-tight">
                    {h.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-2">
                    {h.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* 2 Tabs Switcher & Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-2 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          {/* Tabs */}
          <div className="flex p-1 gap-1 rounded-xl bg-slate-100/90 w-full md:w-auto">
            <button
              type="button"
              onClick={() => handleTabChange("terms")}
              className={cn(
                "flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all",
                activeTab === "terms"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Scale className="w-4 h-4" />
              <span>Terms &amp; Conditions</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-blue-50 text-blue-700 border-0">
                10 Sections
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("privacy")}
              className={cn(
                "flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all",
                activeTab === "privacy"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Privacy Policy</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-blue-50 text-blue-700 border-0">
                8 Sections
              </Badge>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="search"
              placeholder={`Search in ${activeTab === "terms" ? "Terms & Conditions" : "Privacy Policy"}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-slate-50 border-slate-200 text-xs focus-visible:ring-blue-500 w-full"
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
        </div>

        {/* Main Content Layout: Jump Sidebar + Document Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Table of Contents Sticky Jump List (Desktop) */}
          <div className="hidden lg:block lg:col-span-4 sticky top-20">
            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  Table of Contents
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  {currentDoc.sections.length} Sections
                </span>
              </div>

              <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-1 pr-1 text-xs">
                {currentDoc.sections.map((sec) => (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => scrollToSection(sec.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-xl transition-all flex items-start gap-2 text-xs",
                      activeSectionId === sec.id
                        ? "bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-600"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <span className="shrink-0 w-5 text-center font-mono font-bold text-slate-400">
                      {sec.number}.
                    </span>
                    <span className="line-clamp-1 flex-1">{sec.title}</span>
                  </button>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-100">
                <Link
                  href="/delete-account"
                  className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/70 border border-rose-100 hover:bg-rose-100/60 transition-colors text-xs text-rose-700 font-semibold"
                >
                  <span className="flex items-center gap-1.5">
                    <span>Delete Courier Account</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Sections List */}
          <div className="lg:col-span-8 space-y-6">
            {/* Active Document Overview Card */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white border border-blue-100 shadow-2xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  {activeTab === "terms" ? (
                    <Scale className="w-5 h-5 text-blue-600" />
                  ) : (
                    <ShieldCheck className="w-5 h-5 text-blue-600" />
                  )}
                  {currentDoc.title}
                </h2>
                <Badge variant="outline" className="text-xs font-semibold text-blue-700 border-blue-200">
                  Version {currentDoc.version}
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {currentDoc.summary}
              </p>
            </div>

            {/* Empty State if search finds no match */}
            {filteredSections.length === 0 && (
              <div className="p-10 text-center rounded-2xl bg-white border border-slate-200/80 space-y-3">
                <Info className="w-8 h-8 text-slate-400 mx-auto" />
                <h3 className="text-sm font-bold text-slate-900">No sections found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  No sections in {activeTab === "terms" ? "Terms & Conditions" : "Privacy Policy"} matched &quot;{searchQuery}&quot;. Try clearing your query or switching tabs.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  className="text-xs rounded-xl"
                >
                  Clear Search
                </Button>
              </div>
            )}

            {/* Render Section Cards */}
            {filteredSections.map((sec) => (
              <div
                id={sec.id}
                key={sec.id}
                className="scroll-mt-24 p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow space-y-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                    {sec.number}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900">
                      {sec.title}
                    </h3>
                    {sec.summary && (
                      <p className="text-xs text-blue-700 font-medium mt-0.5">
                        {sec.summary}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  <p>{sec.content}</p>
                </div>

                {sec.bullets && sec.bullets.length > 0 && (
                  <ul className="space-y-2 pt-1 border-t border-slate-100">
                    {sec.bullets.map((b, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            {/* Bottom Help & Contact Bar */}
            <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <h4 className="text-sm font-bold text-slate-900">
                  Questions Regarding Rider Terms or Privacy?
                </h4>
                <p className="text-xs text-slate-500">
                  Our Courier Operations and Legal Compliance team in Sierra Leone is here to help.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href="mailto:support@meeemsl.com"
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  Contact Support
                </a>
                <Link
                  href="/riderapp"
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
                >
                  Rider Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  if (isEmbed) {
    return <div className="min-h-screen bg-slate-50/70">{content}</div>
  }

  return <PublicLayout>{content}</PublicLayout>
}
