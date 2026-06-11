"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Search, Eye, RefreshCw, X, Building2, User, Phone, Users } from "lucide-react"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import { formatCurrency } from "@/lib/utils"
import { buildAdminPageUrl } from "@/lib/admin-pagination"
import { AdminPagination } from "@/components/admin/admin-pagination"

type Booking = {
  id: string
  guestName: string
  guestPhone: string
  checkIn: string
  checkOut: string
  numberOfRooms: number
  adults: number
  children: number
  totalPrice: number
  status: string
  createdAt: string
  room: {
    id: string
    name: string
  }
  hotel: {
    id: string
    name: string
    city: string | null
  }
}

function CustomerHotelBookingsClient() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const perPage = 10

  const qParam = searchParams.get("q") ?? ""
  const statusParam = searchParams.get("status") ?? ""
  const hotelIdParam = searchParams.get("hotelId") ?? ""
  const checkInParam = searchParams.get("checkIn") ?? ""
  const checkOutParam = searchParams.get("checkOut") ?? ""

  const [bookings, setBookings] = useState<Booking[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [hotelsList, setHotelsList] = useState<{ id: string; name: string }[]>([])

  const [searchQuery, setSearchQuery] = useState(qParam)
  const [selectedStatus, setSelectedStatus] = useState(statusParam)
  const [selectedHotel, setSelectedHotel] = useState(hotelIdParam)
  const [checkInDate, setCheckInDate] = useState(checkInParam)
  const [checkOutDate, setCheckOutDate] = useState(checkOutParam)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const canCancel = (booking: Booking) => {
    if (booking.status !== "CONFIRMED") return false
    const now = new Date()
    const checkIn = new Date(booking.checkIn)
    const diffInMs = checkIn.getTime() - now.getTime()
    const diffInHours = diffInMs / (1000 * 60 * 60)
    return diffInHours >= 24
  }

  const handleCancelBooking = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this booking? You will receive a 100% refund in your wallet.")) return
    setCancellingId(id)
    try {
      const res = await fetch(`/api/customer/hotel-bookings/${id}/cancel`, {
        method: "POST",
      })
      const data = await res.json()
      if (data.success) {
        alert(data.message || "Booking cancelled successfully.")
        setSelectedBooking(null)
        fetchBookings()
      } else {
        alert(data.error || "Failed to cancel booking.")
      }
    } catch (e) {
      console.error(e)
      alert("An error occurred while cancelling the booking.")
    } finally {
      setCancellingId(null)
    }
  }

  // Sync local states from URL
  useEffect(() => {
    setSearchQuery(qParam)
    setSelectedStatus(statusParam)
    setSelectedHotel(hotelIdParam)
    setCheckInDate(checkInParam)
    setCheckOutDate(checkOutParam)
  }, [qParam, statusParam, hotelIdParam, checkInParam, checkOutParam])

  // Load customer's unique booked hotels for filter list
  useEffect(() => {
    fetch("/api/customer/hotel-bookings?perPage=100")
      .then((res) => res.json())
      .then((json) => {
        if (json?.data) {
          const uniqueHotelsMap = new Map<string, string>()
          json.data.forEach((b: any) => {
            if (b.hotel) {
              uniqueHotelsMap.set(b.hotel.id, b.hotel.name)
            }
          })
          setHotelsList(Array.from(uniqueHotelsMap.entries()).map(([id, name]) => ({ id, name })))
        }
      })
      .catch((err) => console.error("Failed to load unique hotels list:", err))
  }, [])

  const fetchBookings = useCallback(async () => {
    setLoading(true)
    try {
      let url = `/api/customer/hotel-bookings?page=${page}&perPage=${perPage}&`
      if (qParam) url += `q=${encodeURIComponent(qParam)}&`
      if (statusParam) url += `status=${statusParam}&`
      if (hotelIdParam) url += `hotelId=${hotelIdParam}&`
      if (checkInParam) url += `checkIn=${checkInParam}&`
      if (checkOutParam) url += `checkOut=${checkOutParam}&`

      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        setBookings(data.data)
        setTotalPages(data.totalPages || 1)
        setTotalCount(data.totalCount || 0)
      }
    } catch (error) {
      console.error("Failed to load bookings:", error)
    } finally {
      setLoading(false)
    }
  }, [page, perPage, qParam, statusParam, hotelIdParam, checkInParam, checkOutParam])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const params = {
      q: searchQuery || undefined,
      status: selectedStatus || undefined,
      hotelId: selectedHotel || undefined,
      checkIn: checkInDate || undefined,
      checkOut: checkOutDate || undefined,
    }
    router.push(buildAdminPageUrl("/customer/hotel-bookings", 1, params))
  }

  const clearFilters = () => {
    setSearchQuery("")
    setSelectedStatus("")
    setSelectedHotel("")
    setCheckInDate("")
    setCheckOutDate("")
    router.push("/customer/hotel-bookings")
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status.toUpperCase()) {
      case "CONFIRMED": return "bg-emerald-50 text-emerald-700 border-emerald-100"
      case "PENDING": return "bg-amber-50 text-amber-700 border-amber-100"
      case "CANCELLED": return "bg-rose-50 text-rose-700 border-rose-100"
      default: return "bg-slate-50 text-slate-700 border-slate-100"
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search hotel name or room..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 rounded-xl border-slate-200 bg-slate-50/50 text-slate-800 placeholder-slate-400 text-sm focus-visible:ring-emerald-500/20"
              />
            </div>

            <div className="flex flex-wrap md:flex-nowrap gap-3">
              <select
                value={selectedHotel}
                onChange={(e) => setSelectedHotel(e.target.value)}
                className="h-10 border border-slate-200 rounded-xl px-3 text-slate-700 bg-slate-50/50 text-xs font-semibold focus:outline-none min-w-[150px]"
              >
                <option value="">All Booked Hotels</option>
                {hotelsList.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="h-10 border border-slate-200 rounded-xl px-3 text-slate-700 bg-slate-50/50 text-xs font-semibold focus:outline-none min-w-[130px]"
              >
                <option value="">All Statuses</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="PENDING">Pending</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center pt-2 border-t border-slate-50">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">Check-in After:</span>
              <Input
                type="date"
                value={checkInDate}
                onChange={(e) => setCheckInDate(e.target.value)}
                className="h-9 rounded-xl border-slate-200 text-xs font-semibold bg-slate-50/50 text-slate-800"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">Check-out Before:</span>
              <Input
                type="date"
                value={checkOutDate}
                onChange={(e) => setCheckOutDate(e.target.value)}
                className="h-9 rounded-xl border-slate-200 text-xs font-semibold bg-slate-50/50 text-slate-800"
              />
            </div>
            <div className="sm:ml-auto w-full sm:w-auto flex gap-2 justify-end">
              {(qParam || statusParam || hotelIdParam || checkInParam || checkOutParam) && (
                <Button type="button" variant="outline" size="sm" onClick={clearFilters} className="rounded-xl font-bold text-xs uppercase tracking-wider h-10 px-4">
                  Reset
                </Button>
              )}
              <Button type="submit" size="sm" className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider h-10 px-6 w-full sm:w-auto">
                Search
              </Button>
            </div>
          </div>
        </form>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <RefreshCw className="h-7 w-7 text-blue-600 animate-spin" />
          <p className="text-slate-400 font-semibold text-xs">Loading stays...</p>
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
          <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Hotel Bookings Found</h3>
          <p className="text-slate-500 text-xs font-semibold mt-1">You have no hotel bookings matching your selection.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-50 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4">Hotel / Property</th>
                  <th className="px-6 py-4">Guest</th>
                  <th className="px-6 py-4">Check In</th>
                  <th className="px-6 py-4">Check Out</th>
                  <th className="px-6 py-4 text-center">Rooms</th>
                  <th className="px-6 py-4">Total Paid</th>
                  <th className="px-6 py-4">Booked On</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-700 text-sm font-semibold">
                {bookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-slate-900 font-bold leading-tight">{booking.hotel.name}</p>
                        <p className="text-emerald-600 text-xs font-bold mt-0.5">{booking.room.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-slate-900 font-bold">{booking.guestName}</p>
                        <p className="text-slate-400 text-xs font-semibold mt-0.5">{booking.guestPhone}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {new Date(booking.checkIn).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {new Date(booking.checkOut).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-slate-800">
                      {booking.numberOfRooms}
                    </td>
                    <td className="px-6 py-4 text-slate-900 font-black">
                      {formatCurrency(booking.totalPrice)}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs font-semibold">
                      {new Date(booking.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center border rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeClass(booking.status)}`}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Button
                        size="sm"
                        onClick={() => setSelectedBooking(booking)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg h-8 w-8 p-0"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-8 border-t border-slate-50 bg-slate-50/50">
            <AdminPagination
              basePath="/customer/hotel-bookings"
              currentPage={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={perPage}
              params={searchParams}
            />
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] border border-slate-100 max-w-lg w-full overflow-hidden shadow-2xl p-6 sm:p-8 space-y-6 relative">
            <button
              onClick={() => setSelectedBooking(null)}
              className="absolute top-6 right-6 h-8 w-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <div>
              <h3 className="text-lg font-black text-slate-900">Booking Details</h3>
              <p className="text-slate-400 text-xs font-semibold mt-1">Full stay breakdown and occupant configurations.</p>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4 text-sm font-semibold text-slate-600">
              <div className="flex justify-between border-b border-slate-100 pb-2.5">
                <span>Guest Name:</span>
                <span className="font-bold text-slate-900 flex items-center gap-1">
                  <User className="h-4 w-4 text-slate-400" /> {selectedBooking.guestName}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2.5">
                <span>Phone Number:</span>
                <span className="font-bold text-slate-900 flex items-center gap-1">
                  <Phone className="h-4 w-4 text-slate-400" /> {selectedBooking.guestPhone}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2.5">
                <span>Hotel / Property:</span>
                <span className="font-bold text-slate-900">{selectedBooking.hotel.name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2.5">
                <span>Suite Category:</span>
                <span className="font-bold text-slate-900">{selectedBooking.room.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-2.5">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Check-in</span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">{new Date(selectedBooking.checkIn).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Check-out</span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">{new Date(selectedBooking.checkOut).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2.5">
                <span>Occupants:</span>
                <span className="font-bold text-slate-900 flex items-center gap-1">
                  <Users className="h-4 w-4 text-slate-400" />
                  {selectedBooking.adults} Adults {selectedBooking.children > 0 ? `, ${selectedBooking.children} Children` : ""}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2.5">
                <span>Rooms Booked:</span>
                <span className="font-bold text-slate-900">{selectedBooking.numberOfRooms}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2.5">
                <span>Booking Date:</span>
                <span className="font-bold text-slate-900">{new Date(selectedBooking.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Cost Paid:</span>
                <span className="font-black text-emerald-600 text-base">{formatCurrency(selectedBooking.totalPrice)}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center">
              {canCancel(selectedBooking) && (
                <Button
                  onClick={() => handleCancelBooking(selectedBooking.id)}
                  disabled={cancellingId === selectedBooking.id}
                  variant="destructive"
                  className="rounded-xl h-10 px-5"
                >
                  {cancellingId === selectedBooking.id ? "Cancelling..." : "Cancel Booking"}
                </Button>
              )}
              <Button onClick={() => setSelectedBooking(null)} className="bg-slate-950 hover:bg-slate-900 text-white rounded-xl h-10 px-5 ml-auto">
                Close Details
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CustomerHotelBookingsPage() {
  return (
    <div className="container mx-auto max-w-6xl p-4 sm:p-6 font-sans antialiased">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-[24px]">
          My Hotel Bookings
          <span className="mt-2 block h-1 w-14 rounded-full bg-blue-600" aria-hidden />
        </h1>
        <p className="mt-3 text-sm text-gray-600 sm:text-base">
          Track and inspect details of your hotel room reservations.
        </p>
      </div>

      <Suspense fallback={<div className="flex items-center justify-center py-20 text-slate-400 text-sm font-semibold">Loading bookings...</div>}>
        <CustomerHotelBookingsClient />
      </Suspense>
    </div>
  )
}
