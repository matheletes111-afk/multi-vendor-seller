"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Alert, AlertDescription } from "@/ui/alert"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/ui/dialog"
import { cn, formatCurrency } from "@/lib/utils"
import { PageLoader } from "@/components/ui/page-loader"
import { Pencil, Trash2, Search, X, Calendar, Filter, Eye, Briefcase, AlertCircle, Clock } from "lucide-react"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { buildAdminPageUrl } from "@/lib/admin-pagination"
import Checkbox from "@/ui/checkbox-v2"

type Service = {
  id: string
  name: string
  description: string | null
  serviceType: "APPOINTMENT" | "FIXED_PRICE"
  basePrice: number | null
  discount: number
  hasGst: boolean
  duration: number | null
  isActive: boolean
  images: unknown
  galleryImages: unknown
  createdAt: string
  serviceCategory: { id: string; name: string }
  seller: { id: string; store: { name: string } | null; user: { name: string | null; email: string } }
  packages: { id: string; name: string; description: string | null; price: number; features: unknown }[]
  slots: { id: string; startTime: string; endTime: string; isBooked: boolean }[]
  _count: { orderItems: number; reviews: number }
}

export function ServicesClient() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "10", 10) || 10))

  // Filters from URL
  const searchQ = searchParams.get("search") ?? ""
  const sellerIdParam = searchParams.get("sellerId") ?? "all"
  const categoryIdParam = searchParams.get("serviceCategoryId") ?? "all"
  const statusParam = searchParams.get("status") ?? "all"
  const startParam = searchParams.get("startDate") ?? ""
  const endParam = searchParams.get("endDate") ?? ""

  // Local state
  const [searchInput, setSearchInput] = useState(searchQ)
  const [localSellerId, setLocalSellerId] = useState(sellerIdParam)
  const [localCategoryId, setLocalCategoryId] = useState(categoryIdParam)
  const [localStatus, setLocalStatus] = useState(statusParam)
  const [startDate, setStartDate] = useState(startParam)
  const [endDate, setEndDate] = useState(endParam)

  const [data, setData] = useState<{
    services: Service[]
    serviceSellers: any[]
    serviceCategories: any[]
    totalCount: number
    totalPages: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)
  const [viewService, setViewService] = useState<Service | null>(null)

  const loadServices = useCallback(() => {
    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    params.set("page", page.toString())
    params.set("perPage", perPage.toString())
    if (searchQ) params.set("search", searchQ)
    if (sellerIdParam !== "all") params.set("sellerId", sellerIdParam)
    if (categoryIdParam !== "all") params.set("serviceCategoryId", categoryIdParam)
    if (statusParam !== "all") params.set("status", statusParam)
    if (startParam) params.set("startDate", startParam)
    if (endParam) params.set("endDate", endParam)

    fetch(`/api/admin/services?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch services")
        return res.json()
      })
      .then((json) => {
        setData(json)
      })
      .catch((e) => {
        setError(e.message)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [page, perPage, searchQ, sellerIdParam, categoryIdParam, statusParam, startParam, endParam])

  useEffect(() => {
    loadServices()
    setSelectedIds(new Set())
  }, [loadServices])

  useEffect(() => {
    setSearchInput(searchQ)
    setLocalSellerId(sellerIdParam)
    setLocalCategoryId(categoryIdParam)
    setLocalStatus(statusParam)
    setStartDate(startParam)
    setEndDate(endParam)
  }, [searchQ, sellerIdParam, categoryIdParam, statusParam, startParam, endParam])

  const handleSearch = () => {
    const params = {
      search: searchInput || undefined,
      sellerId: localSellerId === "all" ? undefined : localSellerId,
      serviceCategoryId: localCategoryId === "all" ? undefined : localCategoryId,
      status: localStatus === "all" ? undefined : localStatus,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }
    router.push(buildAdminPageUrl("/admin/services", 1, params))
  }

  const handleClear = () => {
    setSearchInput("")
    setLocalSellerId("all")
    setLocalCategoryId("all")
    setLocalStatus("all")
    setStartDate("")
    setEndDate("")
    router.push("/admin/services")
  }

  const toggleSelectAll = () => {
    if (data?.services && selectedIds.size === data.services.length && data.services.length > 0) {
      setSelectedIds(new Set())
    } else if (data?.services) {
      setSelectedIds(new Set(data.services.map((s) => s.id)))
    }
  }

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    setIsBulkDeleting(true)
    try {
      const res = await fetch("/api/admin/services", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || "Bulk delete failed")
      }
      setSelectedIds(new Set())
      await loadServices()
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsBulkDeleting(false)
      setIsBulkDeleteDialogOpen(false)
    }
  }

  const handleDelete = async (serviceId: string) => {
    setDeletingId(serviceId)
    try {
      const res = await fetch(`/api/admin/services/${serviceId}`, { method: "DELETE" })
      if (res.ok) {
        await loadServices()
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "Delete failed")
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setDeletingId(null)
    }
  }

  function firstImageUrl(s: Service): string | null {
    const imgs = Array.isArray(s.images)
      ? s.images
      : typeof s.images === "string"
      ? (() => {
          try {
            return JSON.parse(s.images as string) as string[]
          } catch {
            return []
          }
        })()
      : []
    return imgs.length > 0 ? (imgs[0] as string) : null
  }

  const paginationParams = {
    search: searchQ || undefined,
    sellerId: sellerIdParam !== "all" ? sellerIdParam : undefined,
    serviceCategoryId: categoryIdParam !== "all" ? categoryIdParam : undefined,
    status: statusParam !== "all" ? statusParam : undefined,
    startDate: startParam || undefined,
    endDate: endParam || undefined,
  }

  if (loading && !data) return <PageLoader message="Loading services..." />

  return (
    <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Service Management</h1>
          <p className="text-muted-foreground mt-2 font-medium">Moderate and edit services listed by all providers.</p>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <Badge variant="outline" className="px-4 py-1.5 rounded-full border-primary/20 bg-primary/5 text-primary font-bold shadow-sm">
              {data.totalCount} Total Services
            </Badge>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="border-none shadow-xl bg-destructive/10 text-destructive animate-in slide-in-from-top-4 duration-500">
          <AlertCircle className="h-5 w-5" />
          <AlertDescription className="font-medium">{error}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-br from-background via-background to-muted/20">
        <CardHeader className="pb-6">
          <div className="flex items-center gap-2 mb-6 px-4">
            <Filter className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold uppercase tracking-wider">Search & Filters</CardTitle>
          </div>
          <div className="px-4">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
              {/* Service Search */}
              <div className="flex-1 min-w-[250px] max-w-[350px] space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground ml-1">Search Service</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search name, description..."
                    className="pl-9 rounded-2xl h-12 bg-background/50 border-muted focus-visible:ring-primary/20"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                </div>
              </div>

              {/* Seller Filter */}
              <div className="w-[220px] space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground ml-1">Filter by Provider</Label>
                <Select value={localSellerId} onValueChange={setLocalSellerId}>
                  <SelectTrigger className="rounded-2xl h-12 bg-background/50 border-muted">
                    <SelectValue placeholder="All Providers" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-xl">
                    <SelectItem value="all">All Providers</SelectItem>
                    {data?.serviceSellers?.map((seller: any) => {
                      const businessName = seller.store?.name || seller.user?.name || "Provider"
                      return (
                        <SelectItem key={seller.id} value={seller.id}>
                          {businessName} ({seller.user.email})
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Category Filter */}
              <div className="w-[180px] space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground ml-1">Filter by Category</Label>
                <Select value={localCategoryId} onValueChange={setLocalCategoryId}>
                  <SelectTrigger className="rounded-2xl h-12 bg-background/50 border-muted">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-xl">
                    <SelectItem value="all">All Categories</SelectItem>
                    {data?.serviceCategories?.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="w-[150px] space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground ml-1">Status</Label>
                <Select value={localStatus} onValueChange={setLocalStatus}>
                  <SelectTrigger className="rounded-2xl h-12 bg-background/50 border-muted">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-xl">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Filter */}
              <div className="min-w-[320px] space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground ml-1">Created Date</Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Calendar className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground opacity-70" />
                    <Input
                      type="date"
                      className="pl-9 rounded-2xl text-xs h-12 w-full bg-background/50 border-muted"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <span className="text-muted-foreground">−</span>
                  <div className="relative flex-1">
                    <Calendar className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground opacity-70" />
                    <Input
                      type="date"
                      className="pl-9 rounded-2xl text-xs h-12 w-full bg-background/50 border-muted"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 py-0.5 ml-auto">
                <Button variant="outline" onClick={handleClear} className="rounded-2xl px-6 h-12 font-medium border-muted hover:bg-muted/50">
                  <X className="h-4 w-4 mr-2" /> Reset
                </Button>
                <Button onClick={handleSearch} className="rounded-2xl px-8 h-12 font-bold shadow-lg shadow-primary/20 transition-all active:scale-95">
                  <Search className="h-4 w-4 mr-2" /> Apply Filters
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        {/* Bulk delete toolbar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between px-8 py-4 bg-primary/5 border-t border-b border-primary/10 animate-in fade-in duration-300">
            <div className="flex items-center gap-3">
              <Badge className="rounded-full px-3 bg-primary text-primary-foreground">
                {selectedIds.size} Selected
              </Badge>
              <p className="text-sm font-medium text-muted-foreground">ready for bulk action</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setSelectedIds(new Set())}>
                Deselect All
              </Button>
              <Dialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="rounded-xl shadow-lg shadow-destructive/10">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Selected
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-3xl">
                  <DialogHeader>
                    <DialogTitle>Bulk Delete Services</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to soft delete {selectedIds.size} service(s)? They will be hidden from view, but bookings history will not be affected.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsBulkDeleteDialogOpen(false)} disabled={isBulkDeleting}>Cancel</Button>
                    <Button variant="destructive" onClick={handleBulkDelete} disabled={isBulkDeleting}>
                      {isBulkDeleting ? "Deleting..." : "Yes, Soft Delete All Selected"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        )}

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="w-[50px] pl-8">
                  <Checkbox
                    checked={data?.services && data.services.length > 0 && selectedIds.size === data.services.length}
                    onChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Preview</TableHead>
                <TableHead>Service Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Provider / Store</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Price / Packages</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-8">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.services?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-32">
                    <div className="flex flex-col items-center gap-2 opacity-20">
                      <Briefcase className="h-16 w-16" />
                      <p className="font-black uppercase tracking-[0.3em] text-sm">No services found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data?.services?.map((service) => {
                  const imgUrl = firstImageUrl(service)
                  return (
                    <TableRow key={service.id} className={cn("group transition-all hover:bg-muted/20 border-b border-muted/10", selectedIds.has(service.id) && "bg-primary/5")}>
                      <TableCell className="pl-8">
                        <Checkbox
                          checked={selectedIds.has(service.id)}
                          onChange={() => toggleSelectOne(service.id)}
                        />
                      </TableCell>
                      <TableCell>
                        {imgUrl ? (
                          <img src={imgUrl} alt={service.name} className="w-12 h-12 rounded-lg object-cover border" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-[10px] text-muted-foreground font-bold border">
                            No Image
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-sm leading-snug">{service.name}</span>
                      </TableCell>
                      <TableCell className="text-xs font-semibold">{service.serviceCategory.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-xs">{service.seller.store?.name || "No Store"}</span>
                          <span className="text-[10px] text-muted-foreground">{service.seller.user.name || service.seller.user.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="rounded-full text-[9px] uppercase px-2 tracking-wider font-bold">
                          {service.serviceType === "APPOINTMENT" ? "Appointment" : "Fixed Price"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {service.serviceType === "FIXED_PRICE" && service.basePrice != null ? (
                          <span className="font-bold text-green-600">{formatCurrency(Math.max(0, service.basePrice - service.discount))}</span>
                        ) : (
                          <span className="font-semibold text-muted-foreground">{service.packages.length} package(s)</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("rounded-full uppercase tracking-widest text-[8px] font-black px-2.5 py-0.5 border-none", service.isActive ? "bg-green-500 text-white" : "bg-red-500 text-white")}>
                          {service.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <div className="flex justify-end items-center gap-2">
                          <Button size="icon" variant="outline" className="h-9 w-9 rounded-full border-muted hover:bg-blue-50 hover:text-blue-600 transition-all shadow-sm" onClick={() => setViewService(service)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button asChild size="icon" variant="outline" className="h-9 w-9 rounded-full border-muted hover:bg-amber-50 hover:text-amber-600 transition-all shadow-sm">
                            <Link href={`/admin/services/${service.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                          <DeleteDialog
                            name={service.name}
                            onDelete={() => handleDelete(service.id)}
                            isDeleting={deletingId === service.id}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>

          {data && (
            <div className="p-8 border-t border-muted/10 bg-muted/5">
              <AdminPagination
                basePath="/admin/services"
                currentPage={page}
                totalPages={data.totalPages}
                totalCount={data.totalCount}
                pageSize={perPage}
                params={paginationParams}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Modal */}
      <Dialog open={viewService !== null} onOpenChange={(open) => !open && setViewService(null)}>
        <DialogContent className="max-w-3xl rounded-[2rem] border-none shadow-2xl p-6 overflow-y-auto max-h-[85vh]">
          {viewService && (
            <div className="space-y-6">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-primary font-bold uppercase tracking-widest text-[9px] px-3 py-1 bg-primary/5 border-primary/20 rounded-full">
                    Service details
                  </Badge>
                </div>
                <DialogTitle className="text-2xl font-black mt-2">{viewService.name}</DialogTitle>
                <DialogDescription className="text-sm font-semibold opacity-70">
                  Provider: {viewService.seller.store?.name || "No Store"} ({viewService.seller.user.email})
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/20 p-4 rounded-2xl border text-xs font-semibold">
                <div>
                  <span className="block text-muted-foreground font-medium uppercase tracking-widest text-[9px]">Category</span>
                  <span className="text-sm mt-0.5 block">{viewService.serviceCategory.name}</span>
                </div>
                <div>
                  <span className="block text-muted-foreground font-medium uppercase tracking-widest text-[9px]">Type</span>
                  <span className="text-sm mt-0.5 block">{viewService.serviceType}</span>
                </div>
                {viewService.duration && (
                  <div>
                    <span className="block text-muted-foreground font-medium uppercase tracking-widest text-[9px]">Duration</span>
                    <span className="text-sm mt-0.5 flex items-center gap-1"><Clock className="h-3 w-3" /> {viewService.duration} mins</span>
                  </div>
                )}
                {viewService.serviceType === "FIXED_PRICE" && viewService.basePrice != null && (
                  <div>
                    <span className="block text-muted-foreground font-medium uppercase tracking-widest text-[9px]">Price</span>
                    <span className="text-sm mt-0.5 block text-green-600 font-bold">{formatCurrency(viewService.basePrice - viewService.discount)}</span>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <h4 className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Description</h4>
                <p className="text-sm text-foreground/90 bg-muted/10 p-3 border rounded-xl leading-relaxed whitespace-pre-wrap">{viewService.description || "No description provided."}</p>
              </div>

              {/* Packages */}
              {viewService.packages.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Packages</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {viewService.packages.map((pkg) => (
                      <Card key={pkg.id} className="rounded-2xl border shadow-sm">
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <CardTitle className="text-sm font-bold">{pkg.name}</CardTitle>
                            <span className="font-black text-green-600 text-sm">{formatCurrency(pkg.price)}</span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-xs text-muted-foreground leading-snug">{pkg.description || "No description."}</p>
                          {Array.isArray(pkg.features) && pkg.features.length > 0 && (
                            <ul className="mt-3 space-y-1 text-[11px] font-medium text-foreground/80 list-disc list-inside">
                              {pkg.features.map((f: string, i) => (
                                <li key={i}>{f}</li>
                              ))}
                            </ul>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button className="rounded-full px-6 font-semibold" onClick={() => setViewService(null)}>Close</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DeleteDialog({
  name,
  onDelete,
  isDeleting,
}: {
  name: string
  onDelete: () => Promise<void>
  isDeleting: boolean
}) {
  const [open, setOpen] = useState(false)

  async function handleDelete() {
    await onDelete()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline" className="h-9 w-9 rounded-full border-muted hover:bg-red-50 hover:text-red-600 transition-all shadow-sm">
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>Soft Delete Service</DialogTitle>
          <DialogDescription>
            Are you sure you want to soft delete &quot;{name}&quot;? It will be deactivated and hidden from search, but previous booking records remain intact.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isDeleting}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Yes, Soft Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
