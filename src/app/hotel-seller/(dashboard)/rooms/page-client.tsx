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
import { cn, formatCurrency } from "@/lib/utils"
import { PageLoader } from "@/components/ui/page-loader"
import { Plus, Bed, Pencil, Trash2, Search, X, Users, Hotel, Filter } from "lucide-react"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { buildAdminPageUrl } from "@/lib/admin-pagination"

type Room = {
  id: string
  name: string
  price: number
  capacityAdults: number
  capacityChildren: number
  totalRooms: number
  isActive: boolean
  images: string[]
  hotel: { name: string }
  createdAt: string
}

export function RoomsPageClient({ hotels }: { hotels: { id: string, name: string }[] }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "10", 10) || 10))

  const qStr = searchParams.get("q") ?? ""
  const hotelIdStr = searchParams.get("hotelId") ?? ""
  const minPriceStr = searchParams.get("minPrice") ?? ""
  const maxPriceStr = searchParams.get("maxPrice") ?? ""

  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const [q, setQ] = useState(qStr)
  const [hotelId, setHotelId] = useState(hotelIdStr)
  const [minPrice, setMinPrice] = useState(minPriceStr)
  const [maxPrice, setMaxPrice] = useState(maxPriceStr)

  const loadRooms = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("page", page.toString())
    params.set("perPage", perPage.toString())
    if (qStr) params.set("q", qStr)
    if (hotelIdStr) params.set("hotelId", hotelIdStr)
    if (minPriceStr) params.set("minPrice", minPriceStr)
    if (maxPriceStr) params.set("maxPrice", maxPriceStr)

    fetch(`/api/hotel-seller/rooms?${params.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        if (json?.rooms) {
          setRooms(json.rooms)
          setTotalCount(json.totalCount ?? 0)
          setTotalPages(json.totalPages ?? 1)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, perPage, qStr, hotelIdStr, minPriceStr, maxPriceStr])

  useEffect(() => {
    loadRooms()
  }, [loadRooms])

  const handleSearch = () => {
    const p = {
      q: q || undefined,
      hotelId: hotelId && hotelId !== "ALL" ? hotelId : undefined,
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined,
    }
    router.push(buildAdminPageUrl("/hotel-seller/rooms", 1, p))
  }

  const handleClear = () => {
    setQ("")
    setHotelId("")
    setMinPrice("")
    setMaxPrice("")
    router.push("/hotel-seller/rooms")
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/hotel-seller/rooms/${id}`, { method: "DELETE" })
      if (res.ok) {
        loadRooms()
        router.refresh()
      }
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return <PageLoader message="Loading rooms..." />

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Room Inventory</h1>
          <p className="text-muted-foreground mt-2">Manage room types and availability</p>
        </div>
        <Button asChild className="rounded-xl shadow-lg shadow-primary/20">
          <Link href="/hotel-seller/rooms/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Room Type
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-1.5 lg:col-span-1">
              <Label className="text-xs uppercase ml-1 opacity-70">Room Name</Label>
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
            <div className="space-y-1.5 lg:col-span-1">
              <Label className="text-xs uppercase ml-1 opacity-70">Select Hotel</Label>
              <Select value={hotelId || "ALL"} onValueChange={setHotelId}>
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
            <div className="space-y-1.5 lg:col-span-2">
              <Label className="text-xs uppercase ml-1 opacity-70">Price Range</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  className="rounded-xl"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
                <span className="text-muted-foreground">−</span>
                <Input
                  type="number"
                  placeholder="Max"
                  className="rounded-xl"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={handleClear} className="flex-1 rounded-xl">
                <X className="h-4 w-4" />
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
                <TableHead>Room Type</TableHead>
                <TableHead>Hotel</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Inventory</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-80 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Bed className="h-16 w-16 mb-4 opacity-10" />
                      <p className="font-semibold text-xl">No rooms found</p>
                      <p className="text-sm opacity-70">Define room types for your hotels to start accepting bookings</p>
                      <Button asChild variant="outline" className="mt-6 rounded-xl border-dashed">
                        <Link href="/hotel-seller/rooms/new">Add New Room Type</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rooms.map((room) => (
                  <TableRow key={room.id} className="hover:bg-muted/10 transition-all border-b-muted/10">
                    <TableCell className="py-4">
                      {room.images?.[0] ? (
                        <div className="relative w-24 h-14 rounded-xl overflow-hidden border border-muted/20 shadow-sm">
                          <img src={room.images[0]} alt={room.name} className="w-full h-full object-cover transform hover:scale-110 transition-transform duration-500" />
                        </div>
                      ) : (
                        <div className="w-24 h-14 rounded-xl bg-muted flex items-center justify-center text-[10px] text-muted-foreground font-bold uppercase">No Image</div>
                      )}
                    </TableCell>
                    <TableCell className="font-bold text-base">{room.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                        <Hotel className="h-3.5 w-3.5 text-primary/60" />
                        {room.hotel.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-xs font-bold bg-muted/50 px-2 py-1 rounded-lg">
                          <Users className="h-3 w-3" /> {room.capacityAdults}
                        </div>
                        {room.capacityChildren > 0 && (
                          <div className="flex items-center gap-1 text-[10px] font-bold bg-muted/30 px-2 py-1 rounded-lg opacity-70">
                            Child: {room.capacityChildren}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-black text-primary text-lg">{formatCurrency(room.price)}</span>
                      <span className="text-[10px] text-muted-foreground block uppercase font-bold tracking-tighter">per night</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="rounded-lg font-bold px-3">
                        {room.totalRooms} Total
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild variant="outline" size="sm" className="rounded-xl border-muted">
                          <Link href={`/hotel-seller/rooms/${room.id}`}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </Link>
                        </Button>
                        <DeleteRoomDialog 
                          name={room.name} 
                          onConfirm={() => handleDelete(room.id)} 
                          loading={deletingId === room.id} 
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
              basePath="/hotel-seller/rooms"
              currentPage={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={perPage}
              params={{ q: qStr, hotelId: hotelIdStr, minPrice: minPriceStr, maxPrice: maxPriceStr }}
            />
          </div>
        )}
      </Card>
    </div>
  )
}

function DeleteRoomDialog({ name, onConfirm, loading }: { name: string; onConfirm: () => void; loading: boolean }) {
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
          <DialogTitle className="text-2xl font-bold">Delete Room Type</DialogTitle>
          <DialogDescription className="text-muted-foreground pt-2">
            Are you sure you want to delete <span className="font-bold text-foreground underline decoration-destructive/30 underline-offset-4">&quot;{name}&quot;</span>? 
            <br /><br />
            This action will remove this room type from search results. Bookings already made will not be affected.
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
