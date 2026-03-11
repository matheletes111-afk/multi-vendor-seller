"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/ui/button"
import { Card, CardContent } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Alert, AlertDescription } from "@/ui/alert"
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
import { formatCurrency } from "@/lib/utils"
import { PageLoader } from "@/components/ui/page-loader"
import { Edit, Trash2, Briefcase } from "lucide-react"

type Service = {
  id: string
  name: string
  basePrice: number | null
  discount: number
  hasGst: boolean
  duration: number | null
  isActive: boolean
  images: unknown
  serviceCategory: { name: string }
  serviceType: string
  slots: unknown[]
  packages: unknown[]
  _count: { orderItems: number; reviews: number }
}

function getServiceImageUrls(images: unknown): string[] {
  if (Array.isArray(images)) return images as string[]
  if (typeof images === "string") try { return JSON.parse(images) as string[] } catch { return [] }
  return []
}

export function ServicesPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/service-seller/services")
      .then((r) => (r.ok ? r.json() : []))
      .then(setServices)
      .finally(() => setLoading(false))
  }, [])

  const paramsError = searchParams.get("error")
  const paramsSuccess = searchParams.get("success")

  async function handleDelete(serviceId: string) {
    const res = await fetch(`/api/service-seller/services/${serviceId}`, { method: "DELETE" })
    if (res.ok) {
      setServices((prev) => prev.filter((s) => s.id !== serviceId))
      router.replace("/service-seller/services?success=Service+deleted+permanently")
    } else {
      const data = await res.json().catch(() => ({}))
      router.replace(`/service-seller/services?error=${encodeURIComponent(data.error || "Delete failed")}`)
    }
  }

  if (loading) return <PageLoader variant="listing" message="Loading services…" />

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Services</h1>
          <p className="text-muted-foreground">Manage your service listings</p>
        </div>
        <Link href="/service-seller/services/new">
          <Button>Add Service</Button>
        </Link>
      </div>

      {paramsError && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{decodeURIComponent(paramsError)}</AlertDescription>
        </Alert>
      )}
      {paramsSuccess && (
        <Alert className="mb-6">
          <AlertDescription>{decodeURIComponent(paramsSuccess)}</AlertDescription>
        </Alert>
      )}

      {services.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No services yet</p>
            <Link href="/service-seller/services/new">
              <Button>Create Your First Service</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 shrink-0">Image</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Category</TableHead>
                  <TableHead className="hidden md:table-cell">Type</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Bookings / Reviews</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => {
                  const imageUrls = getServiceImageUrls(service.images)
                  const firstImage = imageUrls[0]
                  const priceText = service.basePrice != null
                    ? formatCurrency(Math.max(0, service.basePrice - service.discount))
                    : "On request"
                  return (
                    <TableRow key={service.id}>
                      <TableCell>
                        <Link href={`/service-seller/services/${service.id}`} className="block w-12 h-12 rounded overflow-hidden bg-muted shrink-0">
                          {firstImage ? (
                            <img src={firstImage} alt={service.name} className="h-12 w-12 object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="h-12 w-12 flex items-center justify-center text-muted-foreground">
                              <Briefcase className="h-6 w-6" />
                            </div>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/service-seller/services/${service.id}`} className="font-medium hover:underline line-clamp-2">
                          {service.name}
                        </Link>
                        <p className="text-xs text-muted-foreground sm:hidden mt-0.5">{service.serviceCategory.name}</p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">{service.serviceCategory.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{service.serviceType.replace("_", " ")}</TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{priceText}</TableCell>
                      <TableCell>
                        <Badge variant={service.isActive ? "default" : "secondary"}>{service.isActive ? "Active" : "Inactive"}</Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right text-sm text-muted-foreground">
                        {service._count.orderItems} / {service._count.reviews}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/service-seller/services/${service.id}`}>
                              <Edit className="mr-2 h-4 w-4 shrink-0" />
                              Edit
                            </Link>
                          </Button>
                          <DeleteServiceButton
                            serviceId={service.id}
                            serviceName={service.name}
                            orderItemsCount={service._count.orderItems}
                            onDelete={handleDelete}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  )
}

function DeleteServiceButton({
  serviceId,
  serviceName,
  orderItemsCount,
  onDelete,
}: {
  serviceId: string
  serviceName: string
  orderItemsCount: number
  onDelete: (serviceId: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  async function handleDelete() {
    setIsDeleting(true)
    await onDelete(serviceId)
    setOpen(false)
    setIsDeleting(false)
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Service</DialogTitle>
          <DialogDescription>
            {orderItemsCount > 0 ? (
              <>Warning: This service &quot;{serviceName}&quot; has {orderItemsCount} booking(s). Deleting will remove it and all slots/packages. Are you sure?</>
            ) : (
              <>Are you sure you want to permanently delete &quot;{serviceName}&quot;? This cannot be undone.</>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isDeleting}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>{isDeleting ? "Deleting..." : "Yes, Delete Permanently"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
