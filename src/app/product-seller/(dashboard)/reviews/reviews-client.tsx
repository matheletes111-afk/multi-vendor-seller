"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { PageLoader } from "@/components/ui/page-loader"
import { formatDate } from "@/lib/utils"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { MessageSquare, Star } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table"

type ReviewGroupRow = {
  productId: string
  productName: string
  productImage: string | null
  avgRating: number
  reviewCount: number
  latestReviewAt: string | null
}

export function ProductSellerReviewsClient() {
  const searchParams = useSearchParams()
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const perPage = 10
  const [data, setData] = useState<{ groups: ReviewGroupRow[]; totalCount: number; totalPages: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/product-seller/reviews?page=${page}&perPage=${perPage}`)
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
  }, [page, perPage])

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  if (loading && !data) return <PageLoader variant="listing" message="Loading reviews..." />
  const groups = data?.groups ?? []
  const safeGroups = groups.filter(
    (g) => typeof g.productId === "string" && g.productId !== "undefined" && g.productId !== "null" && g.productId.length > 0,
  )
  const totalCount = data?.totalCount ?? 0
  const totalPages = data?.totalPages ?? 1

  const productName = (row: ReviewGroupRow) => {
    const full = row.productName ?? ""
    const limit = 26
    if (expanded[row.productId]) return full
    if (full.length <= limit) return full
    return full.slice(0, limit) + "…"
  }

  const shouldShowSeeMore = (row: ReviewGroupRow) => (row.productName ?? "").length > 26

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reviews</h1>
        <p className="mt-2 text-muted-foreground">Customer ratings for your products</p>
      </div>
      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <MessageSquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No reviews yet</h3>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Avg rating</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="hidden xl:table-cell">Reviews</TableHead>
                  <TableHead className="hidden lg:table-cell">Latest</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {safeGroups.map((row) => (
                  <TableRow key={row.productId}>
                    <TableCell>
                      <Badge variant="outline" className="inline-flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                        {row.avgRating.toFixed(1)}/5
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium max-w-[360px]">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded border bg-slate-100">
                          {row.productImage ? (
                            <img src={row.productImage} alt={row.productName} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full" />
                          )}
                        </div>
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="break-words">{productName(row)}</span>
                        {shouldShowSeeMore(row) && (
                          <button
                            type="button"
                            className="text-xs font-medium text-blue-600 hover:underline w-fit"
                            onClick={() => setExpanded((prev) => ({ ...prev, [row.productId]: !prev[row.productId] }))}
                          >
                            {expanded[row.productId] ? "See less" : "See more"}
                          </button>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">{row.reviewCount}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {row.latestReviewAt ? formatDate(row.latestReviewAt) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.productId && row.productId !== "undefined" && row.productId !== "null" ? (
                        <a href={`/product-seller/reviews/${row.productId}`} className="text-sm text-blue-600 hover:underline">
                          View all
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="px-6 pb-6">
            <AdminPagination
              basePath="/product-seller/reviews"
              currentPage={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={perPage}
            />
          </div>
        </Card>
      )}
    </div>
  )
}

