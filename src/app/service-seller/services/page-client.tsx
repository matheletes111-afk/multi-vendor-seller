"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Alert, AlertDescription } from "@/ui/alert"
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
import { Edit, Trash2 } from "lucide-react"

type Service = {
  id: string
  name: string
  basePrice: number | null
  discount: number
  hasGst: boolean
  duration: number | null
  isActive: boolean
  category: { name: string }
  serviceType: string
  slots: unknown[]
  packages: unknown[]
  _count: { orderItems: number; reviews: number }
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

  if (loading) return <div className="container mx-auto py-8"><p className="text-muted-foreground">Loading...</p></div>

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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Card key={service.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="line-clamp-2">{service.name}</CardTitle>
                    <CardDescription>{service.category.name} • {service.serviceType}</CardDescription>
                  </div>
                  <Badge variant={service.isActive ? "default" : "secondary"}>{service.isActive ? "Active" : "Inactive"}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {service.basePrice != null ? (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Base {formatCurrency(service.basePrice)}{service.discount > 0 && <> · {formatCurrency(service.discount)} off</>}</p>
                      <p className="text-xl font-bold">{formatCurrency(Math.max(0, service.basePrice - service.discount))} per item</p>
                      <p className="text-xs text-muted-foreground">{service.hasGst ? "15% GST at checkout" : "No GST"}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Price on request</p>
                  )}
                  {service.duration && <p className="text-sm text-muted-foreground">Duration: {service.duration} min</p>}
                  <p className="text-sm text-muted-foreground">Slots: {service.slots.length} | Packages: {service.packages.length}</p>
                  <p className="text-sm text-muted-foreground">Bookings: {service._count.orderItems} | Reviews: {service._count.reviews}</p>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <Link href={`/service-seller/services/${service.id}`}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </Link>
                    </Button>
                    <div className="flex-1">
                      <DeleteServiceButton
                        serviceId={service.id}
                        serviceName={service.name}
                        orderItemsCount={service._count.orderItems}
                        onDelete={handleDelete}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
        <Button variant="destructive" size="sm" className="w-full">
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
