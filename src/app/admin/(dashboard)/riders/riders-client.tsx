"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
  Search,
  Plus,
  Filter,
  RefreshCw,
  MoreVertical,
  Edit,
  Trash2,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MapPin,
  Bike,
  FileText,
  Phone,
  Mail,
  User,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Eye,
  SlidersHorizontal,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Badge } from "@/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs"
import { LOCATION_ZONES } from "@/lib/location-zones"
import { ZoneLocationPicker } from "@/app/riderapp/components/zone-location-picker"
import { VehicleTypeSelector } from "@/app/riderapp/components/vehicle-type-selector"
import { DocUploadPreview } from "@/app/riderapp/components/doc-upload-preview"
import { cn } from "@/lib/utils"

interface RiderItem {
  id: string
  name: string | null
  email: string
  image: string | null
  phone: string | null
  phoneCountryCode: string | null
  isEmailVerified: boolean
  createdAt: string
  updatedAt: string
  rider: {
    id: string
    isApproved: boolean
    isSuspended: boolean
    status: "PENDING" | "APPROVED" | "SUSPENDED" | "REJECTED"
    createdByAdmin: boolean
    onboardingCompleted: boolean
    isFirstLogin: boolean
    vehicleTypes: string[]
    vehicleName: string | null
    vehicleNumber: string | null
    drivingLicenseNo: string | null
    profileImage: string | null
    drivingLicenseDoc: string | null
    nationalIdDoc: string | null
    vehicleInsuranceDoc: string | null
    selectedZones: string[]
    selectedLocations: string[]
    deviceTokens: Array<{ token: string; platform: string; lastActiveAt: string }>
    adminFeedback: string | null
    adminNotes: string | null
  } | null
}

export function RidersClient() {
  const [riders, setRiders] = useState<RiderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Filters
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [sourceFilter, setSourceFilter] = useState("ALL")
  const [zoneFilter, setZoneFilter] = useState("ALL")
  const [locationFilter, setLocationFilter] = useState("")

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedRider, setSelectedRider] = useState<RiderItem | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  // Create Form State
  const [createName, setCreateName] = useState("")
  const [createEmail, setCreateEmail] = useState("")
  const [createPhone, setCreatePhone] = useState("")
  const [createCountryCode, setCreateCountryCode] = useState("+232")
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)

  // Edit Form State
  const [editName, setEditName] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [editCountryCode, setEditCountryCode] = useState("+232")
  const [editStatus, setEditStatus] = useState<"PENDING" | "APPROVED" | "SUSPENDED" | "REJECTED">("APPROVED")
  const [editVehicleTypes, setEditVehicleTypes] = useState<string[]>([])
  const [editVehicleName, setEditVehicleName] = useState("")
  const [editVehicleNumber, setEditVehicleNumber] = useState("")
  const [editDrivingLicenseNo, setEditDrivingLicenseNo] = useState("")
  const [editSelectedZones, setEditSelectedZones] = useState<string[]>([])
  const [editSelectedLocations, setEditSelectedLocations] = useState<string[]>([])
  const [editAdminFeedback, setEditAdminFeedback] = useState("")
  const [editAdminNotes, setEditAdminNotes] = useState("")
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSuccess, setEditSuccess] = useState<string | null>(null)

  // Resend Invite State
  const [resendLoading, setResendLoading] = useState(false)

  const fetchRiders = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        perPage: perPage.toString(),
        status: statusFilter,
      })
      if (sourceFilter !== "ALL") params.append("source", sourceFilter)
      if (search.trim()) params.append("search", search.trim())
      if (zoneFilter !== "ALL") params.append("zone", zoneFilter)
      if (locationFilter.trim()) params.append("location", locationFilter.trim())

      const res = await fetch(`/api/admin/riders?${params.toString()}`)
      const data = await res.json()
      if (res.ok) {
        setRiders(data.riders || [])
        setTotal(data.pagination?.total || 0)
        setTotalPages(data.pagination?.totalPages || 1)
      }
    } catch (err) {
      console.error("Failed to fetch riders:", err)
    } finally {
      setLoading(false)
    }
  }, [page, perPage, statusFilter, sourceFilter, search, zoneFilter, locationFilter])

  useEffect(() => {
    fetchRiders()
  }, [fetchRiders])

  // Open Edit Modal
  const openEditModal = (rider: RiderItem) => {
    setSelectedRider(rider)
    setEditName(rider.name || "")
    setEditPhone(rider.phone || "")
    setEditCountryCode(rider.phoneCountryCode || "+232")
    setEditStatus(rider.rider?.status || "APPROVED")
    setEditVehicleTypes(rider.rider?.vehicleTypes || [])
    setEditVehicleName(rider.rider?.vehicleName || "")
    setEditVehicleNumber(rider.rider?.vehicleNumber || "")
    setEditDrivingLicenseNo(rider.rider?.drivingLicenseNo || "")
    setEditSelectedZones(rider.rider?.selectedZones || [])
    setEditSelectedLocations(rider.rider?.selectedLocations || [])
    setEditAdminFeedback(rider.rider?.adminFeedback || "")
    setEditAdminNotes(rider.rider?.adminNotes || "")
    setEditError(null)
    setEditSuccess(null)
    setEditModalOpen(true)
  }

  // Handle Create Rider Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateLoading(true)
    setCreateError(null)
    setCreateSuccess(null)

    try {
      const res = await fetch("/api/admin/riders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName,
          email: createEmail,
          phone: createPhone,
          phoneCountryCode: createCountryCode,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to create rider.")
      }

      setCreateSuccess("Rider account created and welcome email dispatched!")
      setCreateName("")
      setCreateEmail("")
      setCreatePhone("")
      fetchRiders()
      setTimeout(() => {
        setCreateModalOpen(false)
        setCreateSuccess(null)
      }, 1500)
    } catch (err: any) {
      setCreateError(err.message || "Failed to create rider.")
    } finally {
      setCreateLoading(false)
    }
  }

  // Handle Edit Rider Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRider) return
    setEditLoading(true)
    setEditError(null)
    setEditSuccess(null)

    try {
      const res = await fetch(`/api/admin/riders/${selectedRider.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          phone: editPhone,
          phoneCountryCode: editCountryCode,
          status: editStatus,
          vehicleTypes: editVehicleTypes,
          vehicleName: editVehicleName,
          vehicleNumber: editVehicleNumber,
          drivingLicenseNo: editDrivingLicenseNo,
          selectedZones: editSelectedZones,
          selectedLocations: editSelectedLocations,
          adminFeedback: editAdminFeedback,
          adminNotes: editAdminNotes,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to update rider.")
      }

      setEditSuccess("Rider profile updated successfully.")
      fetchRiders()
      setTimeout(() => {
        setEditModalOpen(false)
        setEditSuccess(null)
      }, 1200)
    } catch (err: any) {
      setEditError(err.message || "Failed to update rider.")
    } finally {
      setEditLoading(false)
    }
  }

  // Handle Resend Invite
  const handleResendInvite = async (riderId: string) => {
    try {
      setResendLoading(true)
      const res = await fetch(`/api/admin/riders/${riderId}/resend-invite`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to resend credentials.")
      alert(data.message || "Credentials re-sent successfully!")
    } catch (err: any) {
      alert(err.message || "Failed to resend credentials.")
    } finally {
      setResendLoading(false)
    }
  }

  // Handle Delete Rider
  const handleDeleteRider = async () => {
    if (!selectedRider) return
    try {
      const res = await fetch(`/api/admin/riders/${selectedRider.id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setDeleteModalOpen(false)
        fetchRiders()
      }
    } catch (err) {
      console.error("Delete rider error:", err)
    }
  }

  const getStatusBadge = (status?: string, isSuspended?: boolean) => {
    if (isSuspended || status === "SUSPENDED") {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300">
          Suspended
        </Badge>
      )
    }
    if (status === "APPROVED") {
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
          Approved / Active
        </Badge>
      )
    }
    if (status === "REJECTED") {
      return (
        <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300">
          Rejected (Needs Correction)
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">
        Pending Onboarding
      </Badge>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <span className="p-2 bg-blue-600/10 text-blue-600 rounded-xl">🚴</span>
            Delivery Riders Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create, inspect, and configure delivery riders, vehicle details, and active delivery zones.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchRiders()}
            disabled={loading}
            className="rounded-xl h-10 gap-1.5"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </Button>

          <Button
            onClick={() => {
              setCreateError(null)
              setCreateSuccess(null)
              setCreateModalOpen(true)
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add New Rider
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-card rounded-2xl border shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-9 h-10 rounded-xl text-xs"
            />
          </div>

          {/* Registration Source Filter */}
          <div>
            <Select
              value={sourceFilter}
              onValueChange={(val) => {
                setSourceFilter(val)
                setPage(1)
              }}
            >
              <SelectTrigger className="h-10 rounded-xl text-xs">
                <SelectValue placeholder="Registration Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Sources</SelectItem>
                <SelectItem value="ADMIN">Created by Admin</SelectItem>
                <SelectItem value="SELF">Self Registered</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div>
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val)
                setPage(1)
              }}
            >
              <SelectTrigger className="h-10 rounded-xl text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="APPROVED">Approved / Active</SelectItem>
                <SelectItem value="PENDING">Pending Onboarding</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Zone Filter */}
          <div>
            <Select
              value={zoneFilter}
              onValueChange={(val) => {
                setZoneFilter(val)
                setPage(1)
              }}
            >
              <SelectTrigger className="h-10 rounded-xl text-xs">
                <SelectValue placeholder="Filter by Zone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Delivery Zones</SelectItem>
                {LOCATION_ZONES.map((z) => (
                  <SelectItem key={z.zone} value={z.zone}>
                    {z.zone} ({z.regions.length} locations)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Specific Location Filter */}
          <div>
            <Input
              type="text"
              placeholder="Search specific location (e.g. Lakka)..."
              value={locationFilter}
              onChange={(e) => {
                setLocationFilter(e.target.value)
                setPage(1)
              }}
              className="h-10 rounded-xl text-xs"
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 pb-0.5 border-t border-border/40">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[11px] font-semibold text-muted-foreground mr-1">Status:</span>
            {["ALL", "APPROVED", "PENDING", "SUSPENDED", "REJECTED"].map((s) => (
              <button
                key={s}
                onClick={() => {
                  setStatusFilter(s)
                  setPage(1)
                }}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-lg transition-colors shrink-0",
                  statusFilter === s
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                )}
              >
                {s === "ALL" ? "All Statuses" : s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[11px] font-semibold text-muted-foreground mr-1">Source:</span>
            {[
              { label: "All Sources", value: "ALL" },
              { label: "Admin Created", value: "ADMIN" },
              { label: "Self Registered", value: "SELF" },
            ].map((src) => (
              <button
                key={src.value}
                onClick={() => {
                  setSourceFilter(src.value)
                  setPage(1)
                }}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-lg transition-colors shrink-0",
                  sourceFilter === src.value
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                )}
              >
                {src.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Riders Table */}
      <div className="border rounded-2xl bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b text-muted-foreground uppercase text-[11px] font-bold tracking-wider">
              <tr>
                <th className="p-4 pl-5">Rider</th>
                <th className="p-4">Contact</th>
                <th className="p-4">Registration Source</th>
                <th className="p-4">Vehicles</th>
                <th className="p-4">Delivery Zones</th>
                <th className="p-4">Status</th>
                <th className="p-4">Devices</th>
                <th className="p-4 text-right pr-5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                    Loading riders directory...
                  </td>
                </tr>
              ) : riders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-muted-foreground">
                    <Bike className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
                    <p className="font-semibold text-foreground text-sm">No riders found</p>
                    <p className="text-xs mt-1">Try adjusting your search terms or filters.</p>
                  </td>
                </tr>
              ) : (
                riders.map((r) => {
                  const zones = (r.rider?.selectedZones as string[]) || []
                  const locs = (r.rider?.selectedLocations as string[]) || []
                  const vehicles = (r.rider?.vehicleTypes as string[]) || []
                  const devices = (r.rider?.deviceTokens as any[]) || []
                  const isAdminCreated = Boolean(r.rider?.createdByAdmin)

                  return (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4 pl-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center font-bold text-blue-700 dark:text-blue-300 overflow-hidden shrink-0 border">
                            {r.image || r.rider?.profileImage ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={r.image || r.rider?.profileImage!}
                                alt={r.name || "Rider"}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              (r.name?.[0] || r.email[0]).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-sm text-foreground">
                              {r.name || "Unnamed Rider"}
                            </div>
                            <div className="text-muted-foreground text-[11px] font-mono">
                              ID: {r.id.slice(0, 10)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-foreground font-medium">
                            <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate max-w-[180px]">{r.email}</span>
                          </div>
                          {r.phone && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Phone className="w-3.5 h-3.5 shrink-0" />
                              <span>{r.phoneCountryCode} {r.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="p-4">
                        {isAdminCreated ? (
                          <Badge variant="outline" className="text-[11px] font-semibold bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 gap-1 inline-flex items-center">
                            <ShieldAlert className="w-3 h-3 text-purple-600" />
                            Admin Created
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 gap-1 inline-flex items-center">
                            <User className="w-3 h-3 text-emerald-600" />
                            Self Registered
                          </Badge>
                        )}
                      </td>

                      <td className="p-4">
                        <div className="flex flex-wrap gap-1 max-w-[160px]">
                          {vehicles.length > 0 ? (
                            vehicles.map((v) => (
                              <Badge key={v} variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                                {v.replace("_", " ")}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-[11px]">Not set</span>
                          )}
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40">
                              {zones.length} Zones
                            </Badge>
                            <span className="text-muted-foreground text-[11px]">
                              ({locs.length} locs)
                            </span>
                          </div>
                          {zones.length > 0 && (
                            <div className="text-[11px] text-muted-foreground truncate max-w-[180px]" title={zones.join(", ")}>
                              {zones.slice(0, 2).join(", ")}{zones.length > 2 ? ` +${zones.length - 2} more` : ""}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="p-4">
                        {getStatusBadge(r.rider?.status, r.rider?.isSuspended)}
                      </td>

                      <td className="p-4">
                        <Badge variant="outline" className="text-[11px]">
                          {devices.length} {devices.length === 1 ? "device" : "devices"}
                        </Badge>
                      </td>

                      <td className="p-4 text-right pr-5">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(r)}
                            className="h-8 px-2 text-xs rounded-lg text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                          >
                            <Edit className="w-3.5 h-3.5 mr-1" />
                            Manage
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl">
                              <DropdownMenuLabel className="text-xs">Rider Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => openEditModal(r)}>
                                <Eye className="w-3.5 h-3.5 mr-2" />
                                View Full Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleResendInvite(r.id)}
                                disabled={resendLoading}
                              >
                                <Send className="w-3.5 h-3.5 mr-2 text-blue-600" />
                                Resend Credentials
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedRider(r)
                                  setDeleteModalOpen(true)
                                }}
                                className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20"
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-2" />
                                Delete Account
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t bg-muted/20 text-xs">
          <div className="text-muted-foreground">
            Showing <strong className="text-foreground">{riders.length}</strong> of <strong className="text-foreground">{total}</strong> riders
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={perPage.toString()}
              onValueChange={(v) => {
                setPerPage(parseInt(v, 10))
                setPage(1)
              }}
            >
              <SelectTrigger className="h-8 w-24 rounded-lg text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 / page</SelectItem>
                <SelectItem value="25">25 / page</SelectItem>
                <SelectItem value="50">50 / page</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="h-8 w-8 p-0 rounded-lg"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <span className="px-2 font-medium">
                {page} / {totalPages || 1}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="h-8 w-8 p-0 rounded-lg"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* CREATE RIDER MODAL */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-md w-[95vw] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              Create Delivery Rider
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Admin-created riders receive an automatic welcome email containing auto-generated credentials and portal login link.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 mt-2">
            {createError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs border border-red-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            {createSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs border border-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{createSuccess}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Full Name *</Label>
              <Input
                type="text"
                placeholder="e.g. Samuel Koroma"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                required
                className="rounded-xl text-xs h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Email Address *</Label>
              <Input
                type="email"
                placeholder="rider@example.com"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                required
                className="rounded-xl text-xs h-10"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1 space-y-1.5">
                <Label className="text-xs font-semibold">Code *</Label>
                <Input
                  type="text"
                  value={createCountryCode}
                  onChange={(e) => setCreateCountryCode(e.target.value)}
                  placeholder="+232"
                  required
                  className="rounded-xl text-xs h-10"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold">Mobile Number *</Label>
                <Input
                  type="tel"
                  placeholder="e.g. 088994462 or 76123456"
                  value={createPhone}
                  onChange={(e) => setCreatePhone(e.target.value)}
                  required
                  className="rounded-xl text-xs h-10"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-200">
              💡 <strong>Note:</strong> A temporary password will be auto-generated and emailed to the rider. On first login, they will configure their documents and delivery zones.
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateModalOpen(false)}
                disabled={createLoading}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs gap-1.5"
              >
                {createLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Create & Send Invite
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT / MANAGE RIDER MODAL */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col p-6 rounded-2xl overflow-hidden">
          <DialogHeader className="pb-3 border-b">
            <DialogTitle className="text-lg font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Bike className="w-5 h-5 text-blue-600" />
                <span>Manage Rider: {selectedRider?.name || selectedRider?.email}</span>
                {selectedRider?.rider?.createdByAdmin ? (
                  <Badge variant="outline" className="text-[11px] font-semibold bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 gap-1 inline-flex items-center">
                    <ShieldAlert className="w-3 h-3 text-purple-600" />
                    Created by Admin
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 gap-1 inline-flex items-center">
                    <User className="w-3 h-3 text-emerald-600" />
                    Self Registered
                  </Badge>
                )}
              </div>
              {selectedRider && getStatusBadge(editStatus, editStatus === "SUSPENDED")}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1">
            {editError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs border border-red-200">
                {editError}
              </div>
            )}
            {editSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs border border-emerald-200">
                {editSuccess}
              </div>
            )}

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid grid-cols-4 w-full rounded-xl bg-muted/60 p-1">
                <TabsTrigger value="overview" className="text-xs rounded-lg">Overview</TabsTrigger>
                <TabsTrigger value="documents" className="text-xs rounded-lg">Documents</TabsTrigger>
                <TabsTrigger value="zones" className="text-xs rounded-lg">Delivery Zones</TabsTrigger>
                <TabsTrigger value="devices" className="text-xs rounded-lg">Devices & Logs</TabsTrigger>
              </TabsList>

              {/* OVERVIEW TAB */}
              <TabsContent value="overview" className="space-y-4 pt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Full Name</Label>
                    <Input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="rounded-xl text-xs h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Account Status</Label>
                    <Select
                      value={editStatus}
                      onValueChange={(val: any) => setEditStatus(val)}
                    >
                      <SelectTrigger className="h-10 rounded-xl text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="APPROVED">Approved / Active</SelectItem>
                        <SelectItem value="PENDING">Pending Review</SelectItem>
                        <SelectItem value="SUSPENDED">Suspended (Blocked from Login)</SelectItem>
                        <SelectItem value="REJECTED">Rejected (Needs Correction)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1 space-y-1.5">
                    <Label className="text-xs font-semibold">Country Code</Label>
                    <Input
                      type="text"
                      value={editCountryCode}
                      onChange={(e) => setEditCountryCode(e.target.value)}
                      className="rounded-xl text-xs h-10"
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs font-semibold">Phone Number</Label>
                    <Input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="rounded-xl text-xs h-10"
                    />
                  </div>
                </div>

                {/* Vehicle Types Multi-Select */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Operated Vehicle Types</Label>
                  <VehicleTypeSelector
                    selectedTypes={editVehicleTypes}
                    onChange={setEditVehicleTypes}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Vehicle Brand / Model</Label>
                    <Input
                      type="text"
                      placeholder="e.g. Honda CB Shine 125"
                      value={editVehicleName}
                      onChange={(e) => setEditVehicleName(e.target.value)}
                      className="rounded-xl text-xs h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Vehicle Plate Number</Label>
                    <Input
                      type="text"
                      placeholder="e.g. SL-204-AB"
                      value={editVehicleNumber}
                      onChange={(e) => setEditVehicleNumber(e.target.value)}
                      className="rounded-xl text-xs h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Driving License Number</Label>
                    <Input
                      type="text"
                      placeholder="e.g. DL-889021"
                      value={editDrivingLicenseNo}
                      onChange={(e) => setEditDrivingLicenseNo(e.target.value)}
                      className="rounded-xl text-xs h-10"
                    />
                  </div>
                </div>

                {/* Admin Feedback (visible to rider on rejection) */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    Admin Feedback (Shown to Rider if Rejected / Correction Needed)
                  </Label>
                  <Textarea
                    placeholder="e.g. Please re-upload a clearer copy of your Driving License..."
                    value={editAdminFeedback}
                    onChange={(e) => setEditAdminFeedback(e.target.value)}
                    rows={2}
                    className="rounded-xl text-xs"
                  />
                </div>

                {/* Internal Admin Notes */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Internal Admin Notes (Private)</Label>
                  <Textarea
                    placeholder="Notes for admin reference..."
                    value={editAdminNotes}
                    onChange={(e) => setEditAdminNotes(e.target.value)}
                    rows={2}
                    className="rounded-xl text-xs"
                  />
                </div>
              </TabsContent>

              {/* DOCUMENTS TAB */}
              <TabsContent value="documents" className="space-y-4 pt-3">
                <div className="p-3 bg-muted/40 rounded-xl text-xs text-muted-foreground">
                  View uploaded verification documents. Click <strong>Preview</strong> on any item to view the full PDF or image in high resolution.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <DocUploadPreview
                    label="National ID / Passport"
                    value={selectedRider?.rider?.nationalIdDoc}
                    disabled
                    onChange={() => {}}
                  />

                  <DocUploadPreview
                    label="Driving License"
                    value={selectedRider?.rider?.drivingLicenseDoc}
                    disabled
                    onChange={() => {}}
                  />

                  <DocUploadPreview
                    label="Vehicle Insurance / Registration"
                    value={selectedRider?.rider?.vehicleInsuranceDoc}
                    disabled
                    onChange={() => {}}
                  />

                  <DocUploadPreview
                    label="Profile Photo"
                    value={selectedRider?.image || selectedRider?.rider?.profileImage}
                    disabled
                    onChange={() => {}}
                  />
                </div>
              </TabsContent>

              {/* ZONES TAB */}
              <TabsContent value="zones" className="space-y-3 pt-3">
                <ZoneLocationPicker
                  selectedLocations={editSelectedLocations}
                  onChange={(locs, zones) => {
                    setEditSelectedLocations(locs)
                    setEditSelectedZones(zones)
                  }}
                />
              </TabsContent>

              {/* DEVICES TAB */}
              <TabsContent value="devices" className="space-y-3 pt-3">
                <div className="p-3 bg-muted/40 rounded-xl text-xs text-muted-foreground">
                  Registered device tokens for push notifications (Laptops, Phones, Tablets).
                </div>

                <div className="space-y-2">
                  {(selectedRider?.rider?.deviceTokens || []).length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground border rounded-xl">
                      No active device tokens recorded yet.
                    </div>
                  ) : (
                    selectedRider?.rider?.deviceTokens?.map((dev, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 border rounded-xl bg-card text-xs">
                        <div>
                          <span className="font-semibold text-foreground capitalize">
                            {dev.platform.replace("_", " ")}
                          </span>
                          <p className="text-[11px] text-muted-foreground font-mono truncate max-w-[320px]">
                            {dev.token}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          Active: {new Date(dev.lastActiveAt).toLocaleString()}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="pt-3 border-t flex flex-row items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => selectedRider && handleResendInvite(selectedRider.id)}
                disabled={resendLoading}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                <Send className="w-3.5 h-3.5 mr-1" />
                Resend Credentials Email
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditModalOpen(false)}
                  disabled={editLoading}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={editLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs"
                >
                  {editLoading ? "Saving Changes..." : "Save Changes"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="max-w-md w-[95vw] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Delete Rider Account?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to permanently delete the rider account for <strong>{selectedRider?.name || selectedRider?.email}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteRider}
              className="rounded-xl text-xs gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
