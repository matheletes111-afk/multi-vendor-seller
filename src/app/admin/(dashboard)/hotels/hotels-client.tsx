"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { cn } from "@/lib/utils"
import { buildAdminPageUrl } from "@/lib/admin-pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select"
import { Badge } from "@/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { PageLoader } from "@/components/ui/page-loader"
import { Search, X, Filter, Eye, Star, Building2 } from "lucide-react"
import Link from "next/link"

export function HotelsClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "10", 10) || 10))
  const searchQ = searchParams.get("search") ?? ""
  const statusParam = searchParams.get("status") ?? "all"
  const hotelSellerIdParam = searchParams.get("hotelSellerId") ?? "all"

  const [searchInput, setSearchInput] = useState(searchQ)
  const [localStatus, setLocalStatus] = useState(statusParam)
  const [localSellerId, setLocalSellerId] = useState(hotelSellerIdParam)

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadHotels = useCallback(() => {
    setLoading(true)
    const searchQs = searchQ ? `&search=${encodeURIComponent(searchQ)}` : ""
    const statusQs = statusParam !== "all" ? `&status=${encodeURIComponent(statusParam)}` : ""
    const sellerQs = hotelSellerIdParam !== "all" ? `&hotelSellerId=${encodeURIComponent(hotelSellerIdParam)}` : ""

    fetch(`/api/admin/hotels?page=${page}&perPage=${perPage}${searchQs}${statusQs}${sellerQs}`)
      .then(res => res.json())
      .then(json => {
        if (json.error) {
          setError(json.error)
        } else {
          setData(json)
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [page, perPage, searchQ, statusParam, hotelSellerIdParam])

  useEffect(() => {
    loadHotels()
  }, [loadHotels])

  const handleSearch = () => {
    const params = {
      search: searchInput || undefined,
      status: localStatus === "all" ? undefined : localStatus,
      hotelSellerId: localSellerId === "all" ? undefined : localSellerId,
    }
    router.push(buildAdminPageUrl("/admin/hotels", 1, params))
  }

  const handleClear = () => {
    setSearchInput("")
    setLocalStatus("all")
    setLocalSellerId("all")
    router.push("/admin/hotels")
  }

  if (loading && !data) return <PageLoader message="Loading hotels..." />

  return (
    <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Hotel Management</h1>
          <p className="text-muted-foreground mt-2 font-medium">Monitor all hotel properties in the system.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-4 py-1.5 rounded-full border-primary/20 bg-primary/5 text-primary font-bold shadow-sm">
            {data?.totalCount || 0} Total Hotels
          </Badge>
        </div>
      </div>

      <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-br from-background via-background to-muted/20">
        <CardHeader className="pb-6">
          <div className="flex items-center gap-2 mb-6 px-4">
            <Filter className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold uppercase tracking-wider">Search & Filters</CardTitle>
          </div>
          <div className="px-4">
            <div className="flex flex-wrap items-end gap-6">
              {/* Hotel Name Search */}
              <div className="flex-1 min-w-[250px] space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground ml-1">Search Property</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search by hotel name, city, state..." 
                    className="pl-9 rounded-2xl h-12 bg-background/50 border-muted focus-visible:ring-primary/20" 
                    value={searchInput} 
                    onChange={e => setSearchInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSearch()}
                  />
                </div>
              </div>

              {/* Hotel Seller Dropdown */}
              <div className="w-[230px] space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground ml-1">Filter by Seller</Label>
                <Select value={localSellerId} onValueChange={setLocalSellerId}>
                  <SelectTrigger className="rounded-2xl h-12 bg-background/50 border-muted">
                    <SelectValue placeholder="All Sellers" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-xl">
                    <SelectItem value="all">All Sellers</SelectItem>
                    {data?.hotelSellers?.map((seller: any) => {
                      const businessName = seller.businessInfo?.businessName || seller.user?.name || "Seller";
                      return (
                        <SelectItem key={seller.id} value={seller.id}>
                          {businessName}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="w-[180px] space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground ml-1">Status</Label>
                <Select value={localStatus} onValueChange={setLocalStatus}>
                  <SelectTrigger className="rounded-2xl h-12 bg-background/50 border-muted">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-xl">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="inactive">Inactive Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSearch} className="rounded-2xl px-8 h-12 font-bold shadow-lg shadow-primary/20 transition-all active:scale-95">
                  Apply Filters
                </Button>
                <Button variant="outline" onClick={handleClear} className="rounded-2xl px-6 h-12 font-medium border-muted hover:bg-muted/50">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="pl-8 py-5">Property Details</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Standing</TableHead>
                <TableHead>Rooms Count</TableHead>
                <TableHead>Seller / Business</TableHead>
                <TableHead className="text-right pr-8">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.hotels?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-32">
                    <div className="flex flex-col items-center gap-2 opacity-20">
                      <Building2 className="h-16 w-16" />
                      <p className="font-black uppercase tracking-[0.3em] text-sm">No hotels found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data?.hotels?.map((hotel: any) => (
                  <TableRow key={hotel.id} className="group transition-all hover:bg-muted/20 border-b border-muted/10">
                    <TableCell className="pl-8 py-5">
                      <div className="flex items-center gap-4">
                        {/* 1st Hotel Image */}
                        {(() => {
                          let hotelImages = [];
                          try {
                            hotelImages = typeof hotel.images === 'string' ? JSON.parse(hotel.images) : hotel.images;
                          } catch (e) {}
                          const firstImg = Array.isArray(hotelImages) && hotelImages.length > 0 ? hotelImages[0] : null;
                          return firstImg ? (
                            <img src={firstImg} alt={hotel.name} className="w-16 h-10 rounded-lg object-cover border shadow-sm shrink-0" />
                          ) : (
                            <div className="w-16 h-10 rounded-lg bg-muted flex items-center justify-center border text-muted-foreground/30 shrink-0">
                              <Building2 className="h-4 w-4" />
                            </div>
                          );
                        })()}

                        {/* Hotel Logo */}
                        {hotel.logo ? (
                          <img src={hotel.logo} alt={hotel.name} className="w-8 h-8 rounded-full object-cover border shadow-sm shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary border shrink-0">
                            <Building2 className="h-4 w-4" />
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="font-bold text-base leading-tight">{hotel.name}</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            {Array.from({ length: hotel.starRating || 0 }).map((_, i) => (
                              <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                            ))}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-sm">
                        {hotel.city && hotel.state ? `${hotel.city}, ${hotel.state}` : hotel.city || hotel.state || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "rounded-full uppercase tracking-widest text-[9px] font-black px-3 py-1 border-none shadow-sm",
                        hotel.isActive ? "bg-green-500 text-white" : "bg-red-500 text-white"
                      )}>
                        {hotel.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-black">{hotel._count?.rooms || 0}</span>
                        <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest opacity-60">Rooms Listed</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">
                          {hotel.hotelSeller?.businessInfo?.businessName || hotel.hotelSeller?.user?.name || "—"}
                        </span>
                        <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-tighter">
                          {hotel.hotelSeller?.user?.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <Button asChild size="icon" variant="outline" className="h-9 w-9 rounded-full border-muted hover:bg-blue-50 hover:text-blue-600 transition-all shadow-sm">
                        <Link href={`/admin/hotels/${hotel.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="p-8 border-t border-muted/10 bg-muted/5">
            <AdminPagination 
              basePath="/admin/hotels" 
              currentPage={page} 
              totalPages={data?.totalPages || 1} 
              totalCount={data?.totalCount || 0} 
              pageSize={perPage} 
              params={{ search: searchQ, status: statusParam, hotelSellerId: hotelSellerIdParam }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
