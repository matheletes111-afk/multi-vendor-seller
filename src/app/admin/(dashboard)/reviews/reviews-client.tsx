"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Input } from "@/ui/input"
import { PageLoader } from "@/components/ui/page-loader"
import { formatDate, cn } from "@/lib/utils"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { buildAdminPageUrl } from "@/lib/admin-pagination"
import { MessageSquare, Star, Search, Package, Wrench, Building2, Utensils } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table"

type ReviewGroupRow = {
  itemType: "product" | "service" | "hotel" | "food"
  itemId: string
  itemName: string
  itemImage: string | null
  avgRating: number
  reviewCount: number
  latestReviewAt: string | null
}

const REVIEW_TABS = [
  { id: "product", label: "Product", icon: Package },
  { id: "service", label: "Service", icon: Wrench },
  { id: "hotel", label: "Hotel", icon: Building2 },
  { id: "restaurant", label: "Restaurant", icon: Utensils },
] as const

export function AdminReviewsClient() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const tab = searchParams.get("tab") || "product"
  const search = searchParams.get("search") || ""
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const perPage = 10

  const [searchTerm, setSearchTerm] = useState(search)
  useEffect(() => setSearchTerm(search), [search])

  const [data, setData] = useState<{ groups: ReviewGroupRow[]; totalCount: number; totalPages: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const tabQs = `&tab=${encodeURIComponent(tab)}`
    const searchQs = search ? `&search=${encodeURIComponent(search)}` : ""

    fetch(`/api/admin/reviews?page=${page}&perPage=${perPage}${tabQs}${searchQs}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json) setData(json)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tab, search, page, perPage])

  const groups = data?.groups ?? []
  const safeGroups = groups.filter(
    (g) => typeof g.itemId === "string" && g.itemId !== "undefined" && g.itemId !== "null" && g.itemId.length > 0
  )
  const totalCount = data?.totalCount ?? 0
  const totalPages = data?.totalPages ?? 1

  const nameKey = (row: ReviewGroupRow) => `${row.itemType}:${row.itemId}`
  const itemName = (row: ReviewGroupRow) => {
    const full = row.itemName ?? ""
    const limit = 32
    const key = nameKey(row)
    if (expanded[key]) return full
    if (full.length <= limit) return full
    return full.slice(0, limit) + "…"
  }
  const shouldShowSeeMore = (row: ReviewGroupRow) => (row.itemName ?? "").length > 32

  const paramsObj = {
    tab: tab === "product" ? undefined : tab,
    search: search || undefined,
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-foreground">Reviews Management</h1>
        <p className="mt-2 text-muted-foreground text-sm font-medium">
          Audit customer ratings and reviews across products, services, hotels, and restaurants.
        </p>
      </div>

      <Card className="border-none shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="bg-muted/30 pb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium uppercase tracking-[0.2em]">Rating Summaries</CardTitle>
          </div>
          <CardDescription className="text-xs font-medium text-muted-foreground/60">
            Select a category tab to inspect items and ratings.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {/* Top Tabs & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-2 border-b">
            <div className="flex flex-wrap gap-2">
              {REVIEW_TABS.map((t) => {
                const Icon = t.icon
                const isActive = tab === t.id
                const tabUrl = buildAdminPageUrl("/admin/reviews", 1, {
                  tab: t.id === "product" ? undefined : t.id,
                  search: search || undefined,
                })
                return (
                  <Link
                    key={t.id}
                    href={tabUrl}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{t.label}</span>
                  </Link>
                )
              })}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                const url = buildAdminPageUrl("/admin/reviews", 1, {
                  tab: tab === "product" ? undefined : tab,
                  search: searchTerm.trim() || undefined,
                })
                router.push(url)
              }}
              className="relative w-full sm:w-80"
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search item name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-8 h-9 text-sm rounded-xl"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("")
                    const url = buildAdminPageUrl("/admin/reviews", 1, {
                      tab: tab === "product" ? undefined : tab,
                      search: undefined,
                    })
                    router.push(url)
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </form>
          </div>

          {loading ? (
            <PageLoader variant="listing" message="Loading reviews..." />
          ) : safeGroups.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/40" />
              <h3 className="text-base font-semibold text-slate-700">No reviews found</h3>
              <p className="text-xs text-muted-foreground">No customer ratings match this category or search.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-xl border border-border/50">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>Avg rating</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead className="hidden xl:table-cell">Total Reviews</TableHead>
                      <TableHead className="hidden lg:table-cell">Latest Feedback</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {safeGroups.map((row) => {
                      const key = nameKey(row)
                      const detailType = row.itemType === "food" ? "restaurant" : row.itemType
                      return (
                        <TableRow key={key}>
                          <TableCell>
                            <Badge variant="outline" className="inline-flex items-center gap-1 font-bold border-amber-200 bg-amber-50 text-amber-900">
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                              {row.avgRating.toFixed(1)}/5
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium max-w-[380px]">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center">
                                {row.itemImage ? (
                                  <img src={row.itemImage} alt={row.itemName} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="h-full w-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-bold">
                                    {row.itemName?.charAt(0)?.toUpperCase() ?? "?"}
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col gap-0.5 min-w-0">
                                <span className="break-words font-semibold text-slate-800 text-sm">{itemName(row)}</span>
                                {shouldShowSeeMore(row) && (
                                  <button
                                    type="button"
                                    className="text-xs font-medium text-primary hover:underline w-fit"
                                    onClick={() => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))}
                                  >
                                    {expanded[key] ? "See less" : "See more"}
                                  </button>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden xl:table-cell text-sm font-semibold text-slate-700">
                            {row.reviewCount} review{row.reviewCount === 1 ? "" : "s"}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                            {row.latestReviewAt ? formatDate(row.latestReviewAt) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link
                              href={`/admin/reviews/${detailType}/${row.itemId}`}
                              className="inline-flex items-center text-xs font-bold text-primary hover:underline"
                            >
                              View all
                            </Link>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <AdminPagination
                basePath="/admin/reviews"
                currentPage={page}
                totalPages={totalPages}
                totalCount={totalCount}
                pageSize={perPage}
                params={paramsObj}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
