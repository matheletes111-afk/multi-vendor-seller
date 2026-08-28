"use client"

import React, { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import {
  FileText,
  Search,
  CheckCircle2,
  ShieldCheck,
  Printer,
  Copy,
  Check,
  Maximize2,
  Lock,
  Scale,
  Building,
  RefreshCw,
  ExternalLink,
  BookOpen,
  Filter,
  Eye,
  Info,
  Trash2,
} from "lucide-react"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Card, CardContent } from "@/ui/card"
import {
  getLegalDocumentsForRole,
  LEGAL_CATEGORIES,
  LegalDocument,
  LegalDocCategory,
} from "@/lib/terms-data"
import { cn } from "@/lib/utils"

interface LegalPolicyTabContentProps {
  role?: "ADMIN" | "SELLER_PRODUCT" | "SELLER_SERVICE" | "SELLER_HOTEL" | "SELLER_RESTAURANT" | "CUSTOMER" | string | null
  initialSlug?: string
  isAcceptedOnboarding?: boolean
  className?: string
}

export function LegalPolicyTabContent({
  role = "ADMIN",
  initialSlug,
  isAcceptedOnboarding = true,
  className,
}: LegalPolicyTabContentProps) {
  const [dynamicTermsDoc, setDynamicTermsDoc] = useState<LegalDocument | null>(null)

  useEffect(() => {
    let active = true
    async function loadDynamicTerms() {
      try {
        const res = await fetch("/mobileapi/terms-and-conditions")
        if (res.ok && active) {
          const json = await res.json()
          if (json.content && json.rawText) {
            setDynamicTermsDoc({
              id: "footer-terms-and-conditions",
              slug: "terms-and-conditions",
              title: json.title || "Terms and Conditions",
              source: "MEEEM Core Policy",
              lastUpdated: json.lastUpdated || "August 2026",
              summary: "General platform terms of use, 4-tier category base commissions, marketplace transactions, account conduct, and liability terms.",
              category: "core",
              applicableRoles: ["ADMIN", "SELLER_PRODUCT", "SELLER_SERVICE", "SELLER_HOTEL", "SELLER_RESTAURANT", "CUSTOMER"],
              content: json.content,
              rawText: json.rawText,
            })
          }
        }
      } catch (err) {
        // Fallback gracefully
      }
    }
    loadDynamicTerms()
    return () => { active = false }
  }, [])

  const allDocs = useMemo(() => {
    const raw = getLegalDocumentsForRole(role)
    if (!dynamicTermsDoc) return raw
    return raw.map((doc) => (doc.slug === "terms-and-conditions" ? dynamicTermsDoc : doc))
  }, [role, dynamicTermsDoc])
  
  const [selectedSlug, setSelectedSlug] = useState<string>(() => {
    if (initialSlug && allDocs.some((d) => d.slug === initialSlug)) {
      return initialSlug
    }
    return allDocs[0]?.slug || "terms-and-conditions"
  })

  const [selectedCategory, setSelectedCategory] = useState<LegalDocCategory | "all">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"formatted" | "raw">("formatted")
  const [copied, setCopied] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)

  // Filter documents by category and search
  const filteredDocs = useMemo(() => {
    return allDocs.filter((doc) => {
      const matchCat = selectedCategory === "all" || doc.category === selectedCategory
      const q = searchQuery.toLowerCase().trim()
      const matchSearch =
        !q ||
        doc.title.toLowerCase().includes(q) ||
        doc.summary.toLowerCase().includes(q) ||
        doc.source.toLowerCase().includes(q) ||
        doc.rawText.toLowerCase().includes(q)
      return matchCat && matchSearch
    })
  }, [allDocs, selectedCategory, searchQuery])

  // Active document
  const activeDoc = useMemo(() => {
    const found = allDocs.find((d) => d.slug === selectedSlug)
    return found || filteredDocs[0] || allDocs[0]
  }, [allDocs, selectedSlug, filteredDocs])

  const handleCopy = () => {
    if (!activeDoc) return
    navigator.clipboard.writeText(activeDoc.rawText || "")
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePrint = () => {
    if (!activeDoc) return
    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${activeDoc.title} - MEEEM Marketplace</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; padding: 40px; max-width: 800px; margin: 0 auto; }
              h1 { font-size: 24px; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
              h2 { font-size: 18px; color: #334155; margin-top: 24px; }
              p { margin: 8px 0; font-size: 14px; }
              .meta { font-size: 12px; color: #64748b; margin-bottom: 24px; }
            </style>
          </head>
          <body>
            <div class="meta">
              <strong>MEEEM Marketplace Legal Document</strong><br>
              Source: ${activeDoc.source} | Last Updated: ${activeDoc.lastUpdated}
            </div>
            ${activeDoc.content}
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
    }
  }

  const getCategoryBadgeClass = (category: LegalDocCategory) => {
    switch (category) {
      case "core":
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200"
      case "seller":
        return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-200"
      case "buyer":
        return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200"
      case "compliance":
        return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200"
      case "security":
        return "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-200"
      default:
        return "bg-slate-100 text-slate-800 border-slate-200"
    }
  }

  const getCategoryIcon = (category: LegalDocCategory) => {
    switch (category) {
      case "core":
        return <Scale className="w-3.5 h-3.5" />
      case "seller":
        return <Building className="w-3.5 h-3.5" />
      case "buyer":
        return <BookOpen className="w-3.5 h-3.5" />
      case "compliance":
        return <ShieldCheck className="w-3.5 h-3.5" />
      case "security":
        return <Lock className="w-3.5 h-3.5" />
      default:
        return <FileText className="w-3.5 h-3.5" />
    }
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header Banner */}
      <div className="rounded-3xl border border-indigo-200/80 bg-gradient-to-r from-blue-700 via-indigo-600 to-indigo-800 p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
                <ShieldCheck className="w-5 h-5 text-indigo-200" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Legal & Policy Library
              </h2>
            </div>
            <p className="text-sm text-indigo-100 max-w-2xl leading-relaxed">
              Official marketplace legal framework, seller and vendor agreements, automated payment settlement policies, data privacy protocols, and regulatory compliance standards.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/delete-account"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-md shadow-rose-900/20 transition-all backdrop-blur-md"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Account Request</span>
            </Link>
            {isAcceptedOnboarding && role !== "CUSTOMER" && (
              <Badge className="bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md">
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>Agreement Accepted & Active</span>
              </Badge>
            )}
            <Badge variant="outline" className="text-indigo-100 border-white/25 px-3 py-1 rounded-full text-xs">
              {allDocs.length} Applicable Docs
            </Badge>
          </div>
        </div>

        {/* Search & Categories Bar */}
        <div className="mt-6 pt-6 border-t border-white/15 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-200" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search terms, agreements, policies..."
              className="pl-10 h-10 bg-white/15 border-white/25 text-white placeholder:text-indigo-200 rounded-2xl focus:bg-white/25 focus:border-white text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-indigo-200 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {LEGAL_CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.id
              const count = cat.id === "all" ? allDocs.length : allDocs.filter((d) => d.category === cat.id).length
              if (count === 0 && cat.id !== "all") return null

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5",
                    isActive
                      ? "bg-white text-indigo-900 shadow-md font-semibold"
                      : "bg-white/15 text-indigo-100 hover:bg-white/25 hover:text-white"
                  )}
                >
                  <span>{cat.label}</span>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full",
                    isActive ? "bg-indigo-100 text-indigo-900" : "bg-white/20 text-white"
                  )}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Main 2-Column Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Document Navigator */}
        <div className="lg:col-span-4 space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Documents List ({filteredDocs.length})
            </span>
            {searchQuery && (
              <span className="text-xs text-indigo-600 font-medium">Filtered</span>
            )}
          </div>

          {filteredDocs.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
              <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700">No documents found</p>
              <p className="text-xs text-slate-500 mt-1">Try clearing your search query</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setSearchQuery(""); setSelectedCategory("all") }}
                className="mt-3 text-xs rounded-xl"
              >
                Reset Filters
              </Button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[750px] overflow-y-auto pr-1">
              {filteredDocs.map((doc) => {
                const isSelected = activeDoc?.id === doc.id
                return (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedSlug(doc.slug)}
                    className={cn(
                      "w-full text-left p-4 rounded-2xl border transition-all flex flex-col gap-2 group relative overflow-hidden",
                      isSelected
                        ? "bg-white border-indigo-600 shadow-md ring-2 ring-indigo-500/20"
                        : "bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/80"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 font-semibold", getCategoryBadgeClass(doc.category))}
                        >
                          {getCategoryIcon(doc.category)}
                          <span className="capitalize">{doc.category}</span>
                        </Badge>
                      </div>
                      <span className="text-[11px] text-slate-400 shrink-0">
                        {doc.lastUpdated}
                      </span>
                    </div>

                    <h4 className={cn(
                      "text-sm font-bold leading-snug line-clamp-2 transition-colors",
                      isSelected ? "text-indigo-950" : "text-slate-800 group-hover:text-indigo-900"
                    )}>
                      {doc.title}
                    </h4>

                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {doc.summary}
                    </p>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] text-slate-400">
                      <span className="truncate max-w-[200px] italic">
                        {doc.source}
                      </span>
                      {isSelected && (
                        <span className="text-indigo-600 font-semibold flex items-center gap-1 text-[11px]">
                          Reading <Eye className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Column: Document Viewer */}
        <div className="lg:col-span-8">
          {activeDoc ? (
            <Card className="rounded-3xl border-slate-200/80 shadow-md bg-white overflow-hidden">
              {/* Document Header */}
              <div className="p-6 border-b border-slate-100 bg-slate-50/60 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={cn("text-xs font-semibold px-2.5 py-0.5 rounded-lg flex items-center gap-1", getCategoryBadgeClass(activeDoc.category))}>
                        {getCategoryIcon(activeDoc.category)}
                        <span className="capitalize">{activeDoc.category} Document</span>
                      </Badge>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-500 font-medium">Last Updated: {activeDoc.lastUpdated}</span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight pt-1">
                      {activeDoc.title}
                    </h3>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setViewMode(viewMode === "formatted" ? "raw" : "formatted")}
                      className="rounded-xl text-xs h-8 border-slate-200 text-slate-700"
                    >
                      {viewMode === "formatted" ? "Plain Text" : "Formatted"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      className="rounded-xl text-xs h-8 border-slate-200 text-slate-700"
                      title="Copy document text"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handlePrint}
                      className="rounded-xl text-xs h-8 border-slate-200 text-slate-700"
                      title="Print or Save as PDF"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">Source:</span>
                    <span className="bg-slate-200/60 px-2 py-0.5 rounded text-[11px] font-mono text-slate-600">
                      {activeDoc.source}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span className="font-medium text-[11px]">Legally Enforceable & Governed by Sierra Leone Laws</span>
                  </div>
                </div>
              </div>

              {/* Document Content View */}
              <div className="p-6 sm:p-8 max-h-[680px] overflow-y-auto bg-white">
                {viewMode === "formatted" ? (
                  <div
                    className="prose prose-slate max-w-none text-slate-700 space-y-4 text-sm leading-relaxed
                      [&>h1]:text-2xl [&>h1]:font-black [&>h1]:text-slate-900 [&>h1]:border-b [&>h1]:border-slate-100 [&>h1]:pb-3 [&>h1]:mb-6
                      [&>h2]:text-base [&>h2]:font-bold [&>h2]:text-slate-900 [&>h2]:mt-6 [&>h2]:mb-2 [&>h2]:pt-2 [&>h2]:border-t [&>h2]:border-slate-100/80
                      [&>p]:text-slate-700 [&>p]:leading-relaxed [&>p]:my-2
                      [&>div]:space-y-3"
                    dangerouslySetInnerHTML={{ __html: activeDoc.content }}
                  />
                ) : (
                  <pre className="text-xs font-mono text-slate-700 bg-slate-50 p-6 rounded-2xl border border-slate-200 whitespace-pre-wrap leading-relaxed">
                    {activeDoc.rawText}
                  </pre>
                )}
              </div>

              {/* Document Footer */}
              <div className="p-4 px-6 border-t border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-slate-400" />
                  <span>Document ID: <code className="font-mono text-slate-700">{activeDoc.id}</code></span>
                </div>
                <div className="flex items-center gap-3">
                  <span>Slug: <code className="font-mono text-indigo-700">{activeDoc.slug}</code></span>
                  <span>•</span>
                  <span>MEEEM Marketplace Legal Repository</span>
                </div>
              </div>
            </Card>
          ) : (
            <div className="p-12 text-center rounded-3xl border border-slate-200 bg-white">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h4 className="text-base font-semibold text-slate-800">Select a Document</h4>
              <p className="text-xs text-slate-500 mt-1">Choose a legal policy from the left list to view its complete terms.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
