"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Input } from "@/ui/input"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/ui/dialog"
import { cn } from "@/lib/utils"
import { PageLoader } from "@/components/ui/page-loader"
import { Plus, Building2, Pencil, Trash2, Search, X, Star, MapPin, Filter } from "lucide-react"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { buildAdminPageUrl } from "@/lib/admin-pagination"

type Hotel = {
  id: string
  name: string
  city: string
  state: string
  starRating: number
  isActive: boolean
  images: string[]
  createdAt: string
  _count: { rooms: number }
}

export function HotelsPageClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "10", 10) || 10))

  const qStr = searchParams.get("q") ?? ""
  const cityStr = searchParams.get("city") ?? ""
  const ratingStr = searchParams.get("rating") ?? ""

  const [hotels, setHotels] = useState<Hotel[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const [q, setQ] = useState(qStr)
  const [city, setCity] = useState(cityStr)
  const [rating, setRating] = useState(ratingStr)

  const loadHotels = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("page", page.toString())
    params.set("perPage", perPage.toString())
    if (qStr) params.set("q", qStr)
    if (cityStr) params.set("city", cityStr)
    if (ratingStr) params.set("rating", ratingStr)

    fetch(`/api/hotel-seller/hotels?${params.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        if (json?.hotels) {
          setHotels(json.hotels)
          setTotalCount(json.totalCount ?? 0)
          setTotalPages(json.totalPages ?? 1)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, perPage, qStr, cityStr, ratingStr])

  useEffect(() => {
    loadHotels()
  }, [loadHotels])

  const handleSearch = () => {
    const p = {
      q: q || undefined,
      city: city || undefined,
      rating: rating && rating !== "ALL" ? rating : undefined,
    }
    router.push(buildAdminPageUrl("/hotel-seller/hotels", 1, p))
  }

  const handleClear = () => {
    setQ("")
    setCity("")
    setRating("")
    router.push("/hotel-seller/hotels")
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/hotel-seller/hotels/${id}`, { method: "DELETE" })
      if (res.ok) {
        loadHotels()
        router.refresh()
      }
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return <PageLoader message="Loading hotels..." />

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Hotels</h1>
          <p className="text-muted-foreground mt-2">Manage your hotel properties</p>
        </div>
        <Button asChild className="rounded-xl shadow-lg shadow-primary/20">
          <Link href="/hotel-seller/hotels/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Hotel
          </Link>
        </Button>
      </div>

      <Card className="rounded-3xl shadow-xl border-none overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold uppercase tracking-wider">Search & Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase ml-1 opacity-70">Hotel Name</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search name..."
                  className="pl-9 rounded-xl"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase ml-1 opacity-70">City</Label>
              <Input
                placeholder="Search city..."
                className="rounded-xl"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase ml-1 opacity-70">Star Rating</Label>
              <Select value={rating || "ALL"} onValueChange={setRating}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="All Ratings" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Ratings</SelectItem>
                  {[1, 2, 3, 4, 5].map((r) => (
                    <SelectItem key={r} value={r.toString()}>{r} Stars</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={handleClear} className="flex-1 rounded-xl">
                <X className="h-4 w-4 mr-2" /> Reset
              </Button>
              <Button onClick={handleSearch} className="flex-1 rounded-xl font-bold shadow-lg shadow-primary/10">
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl shadow-2xl border-none overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent border-b-muted/20">
                <TableHead className="py-5">Preview</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Rooms</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hotels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-80 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground animate-in fade-in duration-500">
                      <Building2 className="h-16 w-16 mb-4 opacity-10" />
                      <p className="font-semibold text-xl">No hotels found</p>
                      <p className="text-sm opacity-70">Try adjusting your filters or add your first property</p>
                      <Button asChild variant="outline" className="mt-6 rounded-xl border-dashed">
                        <Link href="/hotel-seller/hotels/new">Add New Hotel</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                hotels.map((hotel) => (
                  <TableRow key={hotel.id} className="hover:bg-muted/10 transition-all border-b-muted/10">
                    <TableCell className="py-4">
                      {hotel.images?.[0] ? (
                        <div className="relative w-24 h-14 rounded-xl overflow-hidden border border-muted/20 shadow-sm">
                          <img src={hotel.images[0]} alt={hotel.name} className="w-full h-full object-cover transform hover:scale-110 transition-transform duration-500" />
                        </div>
                      ) : (
                        <div className="w-24 h-14 rounded-xl bg-muted flex items-center justify-center text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">No Image</div>
                      )}
                    </TableCell>
                    <TableCell className="font-bold text-base">{hotel.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium">
                        <MapPin className="h-3.5 w-3.5 text-primary/60" />
                        {hotel.city}, {hotel.state}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-400/10 w-fit">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-black text-yellow-700">{hotel.starRating}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="rounded-lg font-bold px-3">
                        {hotel._count.rooms} Rooms
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={hotel.isActive ? "default" : "outline"} className={cn("rounded-lg px-3", hotel.isActive ? "bg-green-500 hover:bg-green-600" : "")}>
                        {hotel.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild variant="outline" size="sm" className="rounded-xl border-muted hover:bg-muted/50">
                          <Link href={`/hotel-seller/hotels/${hotel.id}`}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </Link>
                        </Button>
                        <DeleteHotelDialog 
                          name={hotel.name} 
                          onConfirm={() => handleDelete(hotel.id)} 
                          loading={deletingId === hotel.id} 
                        />
                      </div>
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
              basePath="/hotel-seller/hotels"
              currentPage={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={perPage}
              params={{ q: qStr, city: cityStr, rating: ratingStr }}
            />
          </div>
        )}
      </Card>
    </div>
  )
}

function DeleteHotelDialog({ name, onConfirm, loading }: { name: string; onConfirm: () => void; loading: boolean }) {
  const [open, setOpen] = useState(false)

  const handleConfirm = async () => {
    await onConfirm()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" className="rounded-xl shadow-lg shadow-destructive/10">
          <Trash2 className="h-4 w-4 mr-2" /> Delete
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl border-none">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Delete Hotel</DialogTitle>
          <DialogDescription className="text-muted-foreground pt-2">
            Are you sure you want to delete <span className="font-bold text-foreground underline decoration-destructive/30 underline-offset-4">&quot;{name}&quot;</span>? 
            <br /><br />
            This action will soft-delete the property and all its rooms. It can be restored by Admin if needed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="pt-6 gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
          <Button variant="destructive" className="rounded-xl font-bold" onClick={handleConfirm} disabled={loading}>
            {loading ? "Deleting..." : "Confirm Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
