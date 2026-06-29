"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Label } from "@/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table"
import { Star, MessageSquare, Filter, Building2 } from "lucide-react"
import { PageLoader } from "@/components/ui/page-loader"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { buildAdminPageUrl } from "@/lib/admin-pagination"

type Review = {
  id: string
  hotelId: string
  hotelName: string
  userName: string
  userEmail: string
  rating: number
  comment: string | null
  createdAt: string
}

type HotelOption = {
  id: string
  name: string
}

export function HotelReviewsClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "10", 10) || 10))

  const hotelIdStr = searchParams.get("hotelId") ?? "ALL"

  const [reviews, setReviews] = useState<Review[]>([])
  const [hotels, setHotels] = useState<HotelOption[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Fetch hotels for dropdown filter
  useEffect(() => {
    fetch("/api/hotel-seller/hotels?perPage=100")
      .then((r) => r.json())
      .then((json) => {
        if (json?.hotels) {
          setHotels(json.hotels.map((h: any) => ({ id: h.id, name: h.name })))
        }
      })
      .catch(console.error)
  }, [])

  const loadReviews = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("page", page.toString())
    params.set("perPage", perPage.toString())
    if (hotelIdStr && hotelIdStr !== "ALL") params.set("hotelId", hotelIdStr)

    fetch(`/api/hotel-seller/reviews?${params.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        if (json?.success) {
          setReviews(json.data.reviews)
          setTotalCount(json.data.pagination.totalCount ?? 0)
          setTotalPages(json.data.pagination.totalPages ?? 1)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, perPage, hotelIdStr])

  useEffect(() => {
    loadReviews()
  }, [loadReviews])

  const handleFilterChange = (val: string) => {
    const p = {
      hotelId: val !== "ALL" ? val : undefined,
    }
    router.push(buildAdminPageUrl("/hotel-seller/reviews", 1, p))
  }

  // Calculate stats
  const averageRating = reviews.length > 0 
    ? parseFloat((reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1))
    : 0

  if (loading) return <PageLoader message="Loading reviews..." />

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Hotel Reviews</h1>
        <p className="text-muted-foreground mt-2">See what your guests are saying about your properties</p>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="rounded-3xl border-none shadow-md bg-gradient-to-br from-blue-50 to-blue-100/50">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-blue-700 uppercase tracking-wider">Average Rating</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-4xl font-black text-slate-800">{averageRating.toFixed(1)}</span>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${i < Math.round(averageRating) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600 shrink-0">
              <Star className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-none shadow-md bg-gradient-to-br from-emerald-50 to-emerald-100/50">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-emerald-700 uppercase tracking-wider">Total Reviews</p>
              <span className="text-4xl font-black text-slate-800 mt-2 block">{totalCount}</span>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
              <MessageSquare className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dropdown Filter */}
      <Card className="rounded-3xl shadow-xl border-none overflow-hidden bg-background">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold uppercase tracking-wider">Filter Reviews</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="w-full md:w-72 space-y-1.5">
            <Label className="text-xs uppercase ml-1 opacity-70">Property</Label>
            <Select value={hotelIdStr} onValueChange={handleFilterChange}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="All Hotels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Hotels</SelectItem>
                {hotels.map((h) => (
                  <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Reviews Table */}
      <Card className="rounded-3xl shadow-2xl border-none overflow-hidden bg-background">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent border-b-muted/20">
                <TableHead className="py-5 pl-6">Hotel</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead className="w-1/2">Comment</TableHead>
                <TableHead className="text-right pr-6">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviews.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-80 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <MessageSquare className="h-16 w-16 mb-4 opacity-10" />
                      <p className="font-semibold text-xl">No reviews found</p>
                      <p className="text-sm opacity-70">Guest reviews will appear here once submitted.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                reviews.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/10 transition-all border-b-muted/10">
                    <TableCell className="py-4 pl-6 font-bold text-sm">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        {r.hotelName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-slate-800">{r.userName}</span>
                        <span className="text-xs text-slate-400 font-medium">{r.userEmail}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/10 w-fit">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />
                        <span className="font-black text-amber-800 text-xs">{r.rating}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm font-semibold max-w-md break-words">
                      {r.comment || <span className="text-slate-400 italic">No comment provided.</span>}
                    </TableCell>
                    <TableCell className="text-right text-xs font-semibold text-slate-400 pr-6">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
        {totalPages > 1 && (
          <div className="px-6 py-6 border-t border-muted/10 bg-muted/5">
            <AdminPagination
              basePath="/hotel-seller/reviews"
              currentPage={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={perPage}
              params={{ hotelId: hotelIdStr !== "ALL" ? hotelIdStr : undefined }}
            />
          </div>
        )}
      </Card>
    </div>
  )
}
