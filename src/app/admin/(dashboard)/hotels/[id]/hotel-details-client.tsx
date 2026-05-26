"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { PageLoader } from "@/components/ui/page-loader"
import { Badge } from "@/ui/badge"
import { Label } from "@/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table"
import {
  ArrowLeft,
  Building2,
  MapPin,
  Star,
  Calendar,
  FileText,
  User,
  Mail,
  Phone,
  Briefcase,
  Clock,
  BedDouble,
  DollarSign,
  Users,
  HeartHandshake
} from "lucide-react"

export function HotelDetailsClient({ id }: { id: string }) {
  const router = useRouter()
  const [hotel, setHotel] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/admin/hotels/${id}`)
      .then(res => res.json())
      .then(json => {
        if (json.error) {
          setError(json.error)
        } else {
          setHotel(json)
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <PageLoader message="Loading hotel details..." />
  if (error) return <div className="p-8 text-center text-red-600 font-bold">Error: {error}</div>
  if (!hotel) return <div className="p-8 text-center text-muted-foreground">Hotel not found</div>

  // Parse JSON fields
  let amenities: string[] = []
  try {
    if (hotel.amenities) {
      amenities = typeof hotel.amenities === "string" ? JSON.parse(hotel.amenities) : hotel.amenities
    }
  } catch (e) {
    console.error("Failed to parse amenities:", e)
  }

  return (
    <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-700">
      {/* Header / Back navigation */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.back()}
          className="rounded-full border-muted shadow-sm hover:bg-muted/50"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-black tracking-tight">{hotel.name}</h1>
          <p className="text-muted-foreground font-medium mt-1">Detailed view of property and connected rooms.</p>
        </div>
      </div>

      {/* Main Banner section */}
      {hotel.banner && (
        <div className="relative w-full h-64 rounded-[2.5rem] overflow-hidden border shadow-inner">
          <img src={hotel.banner} alt={hotel.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-8">
            <div className="flex items-center gap-4 text-white">
              {hotel.logo && (
                <img src={hotel.logo} alt={hotel.name} className="w-16 h-16 rounded-full object-cover border-2 border-white shadow" />
              )}
              <div>
                <h2 className="text-2xl font-bold">{hotel.name}</h2>
                <div className="flex items-center gap-1 mt-1">
                  {Array.from({ length: hotel.starRating || 0 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                  <span className="text-xs font-semibold ml-2 text-white/90">({hotel.starRating}-Star Hotel)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: Property and Policies */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-gradient-to-br from-background to-muted/10">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-black uppercase tracking-wider flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" /> Property Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">About the Property</Label>
                <p className="text-sm font-medium mt-1 leading-relaxed text-muted-foreground whitespace-pre-line">
                  {hotel.description || "No description provided."}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-muted/20">
                <div>
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> Address
                  </Label>
                  <p className="text-sm font-bold mt-1 text-primary">
                    {hotel.address || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground font-semibold mt-0.5">
                    {hotel.city && hotel.state ? `${hotel.city}, ${hotel.state}` : hotel.city || hotel.state || ""}
                  </p>
                </div>

                <div>
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                    <HeartHandshake className="h-3.5 w-3.5" /> Standing
                  </Label>
                  <div className="mt-1">
                    <Badge className={cn(
                      "rounded-full uppercase tracking-widest text-[9px] font-black px-3 py-1 border-none shadow-sm",
                      hotel.isActive ? "bg-green-500 text-white" : "bg-red-500 text-white"
                    )}>
                      {hotel.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Amenities */}
              <div className="pt-4 border-t border-muted/20">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Amenities</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {amenities.length > 0 ? (
                    amenities.map((amenity, i) => (
                      <Badge key={i} variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold">
                        {amenity}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground font-medium">No amenities listed.</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Policies */}
          <Card className="rounded-[2.5rem] border-none shadow-xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-black uppercase tracking-wider flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" /> Policies
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Check-in Policy</Label>
                <p className="text-sm font-medium mt-1 leading-relaxed text-muted-foreground whitespace-pre-line">
                  {hotel.checkInPolicy || "Standard check-in rules apply."}
                </p>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Check-out Policy</Label>
                <p className="text-sm font-medium mt-1 leading-relaxed text-muted-foreground whitespace-pre-line">
                  {hotel.checkOutPolicy || "Standard check-out rules apply."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: Seller details */}
        <div>
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-gradient-to-br from-background to-muted/10 h-full">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-black uppercase tracking-wider flex items-center gap-2">
                <User className="h-5 w-5 text-primary" /> Seller Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary border shadow-sm">
                  <User className="h-6 w-6" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-base leading-tight">
                    {hotel.hotelSeller?.user?.name || "Seller User"}
                  </span>
                  <span className="text-xs text-muted-foreground font-semibold uppercase tracking-tighter">
                    Hotel Partner
                  </span>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-muted/20">
                <div className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Email</span>
                    <span className="text-sm font-semibold">{hotel.hotelSeller?.user?.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Business Name</span>
                    <span className="text-sm font-bold text-primary">
                      {hotel.hotelSeller?.businessInfo?.businessName || "—"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Manager</span>
                    <span className="text-sm font-semibold">
                      {hotel.hotelSeller?.businessInfo?.managerName || "—"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">POC Contact</span>
                    <span className="text-sm font-semibold">
                      {hotel.hotelSeller?.businessInfo?.pocContact || "—"}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Rooms Table Listing */}
      <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
        <CardHeader className="bg-muted/30 pb-4">
          <CardTitle className="text-lg font-black uppercase tracking-wider flex items-center gap-2">
            <BedDouble className="h-5 w-5 text-primary" /> Listed Rooms
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/10">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="pl-8 py-5">Room Name</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Amenities</TableHead>
                <TableHead className="pr-8 text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hotel.rooms?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20">
                    <div className="flex flex-col items-center gap-2 opacity-20">
                      <BedDouble className="h-12 w-12" />
                      <p className="font-black uppercase tracking-wider text-xs">No rooms listed for this hotel</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                hotel.rooms?.map((room: any) => {
                  let roomAmenities: string[] = []
                  try {
                    if (room.amenities) {
                      roomAmenities = typeof room.amenities === "string" ? JSON.parse(room.amenities) : room.amenities
                    }
                  } catch (e) {
                    console.error("Failed to parse room amenities:", e)
                  }

                  return (
                    <TableRow key={room.id} className="hover:bg-muted/10 border-b border-muted/5">
                      <TableCell className="pl-8 py-5">
                        <div className="flex items-center gap-3">
                          {room.images && Array.isArray(room.images) && room.images.length > 0 ? (
                            <img src={room.images[0]} alt={room.name} className="w-12 h-12 rounded-xl object-cover border" />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center border text-muted-foreground">
                              <BedDouble className="h-5 w-5" />
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span className="font-bold text-sm">{room.name}</span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-xs">{room.description || "No description"}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{room.capacityAdults} Adults</span>
                          {room.capacityChildren > 0 && (
                            <span className="text-muted-foreground">/ {room.capacityChildren} Children</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-black text-sm text-primary flex items-center">
                          <DollarSign className="h-3.5 w-3.5 shrink-0" />
                          {room.price.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-xs">{room.totalRooms} Rooms</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {roomAmenities.map((am: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-[9px] font-bold px-2 py-0.5 rounded-full">
                              {am}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="pr-8 text-right">
                        <Badge className={cn(
                          "rounded-full uppercase tracking-widest text-[9px] font-black px-3 py-1 border-none shadow-sm",
                          room.isActive ? "bg-green-500 text-white" : "bg-red-500 text-white"
                        )}>
                          {room.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
