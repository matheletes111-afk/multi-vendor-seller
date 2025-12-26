import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { formatCurrency } from "@/lib/utils"
import { Briefcase, Store, Star, Clock, Calendar } from "lucide-react"

export default async function ServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const service = await prisma.service.findUnique({
    where: { id, isActive: true },
    include: {
      category: true,
      seller: {
        include: {
          store: true,
        },
      },
      packages: true,
      slots: {
        where: { isBooked: false },
        take: 10,
        orderBy: { startTime: "asc" },
      },
      _count: {
        select: {
          reviews: true,
        },
      },
    },
  })

  if (!service) {
    notFound()
  }

  const images = Array.isArray(service.images) ? service.images as string[] : []

  return (
    <div className="container mx-auto p-6">
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          {images.length > 0 ? (
            <div className="aspect-square w-full overflow-hidden rounded-lg border bg-muted">
              <img
                src={images[0]}
                alt={service.name}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="aspect-square w-full bg-muted rounded-lg flex items-center justify-center">
              <Briefcase className="h-16 w-16 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">{service.category.name}</Badge>
              <Badge variant="secondary">{service.serviceType}</Badge>
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">{service.name}</h1>
            {service.basePrice ? (
              <p className="text-4xl font-bold">{formatCurrency(service.basePrice)}</p>
            ) : (
              <p className="text-lg text-muted-foreground">Price on request</p>
            )}
          </div>

          <Separator />

          {service.description && (
            <div>
              <h2 className="text-lg font-semibold mb-2">Description</h2>
              <p className="text-muted-foreground">{service.description}</p>
            </div>
          )}

          <div className="space-y-4">
            {service.duration && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Duration: {service.duration} minutes</span>
              </div>
            )}
            {service._count.reviews > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Star className="h-4 w-4" />
                <span>{service._count.reviews} review{service._count.reviews !== 1 ? "s" : ""}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Store className="h-4 w-4" />
              <span>Sold by: {service.seller.store?.name || "Store"}</span>
            </div>
          </div>

          {service.serviceType === "APPOINTMENT" && service.slots.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Available Slots
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {service.slots.map((slot) => (
                    <div
                      key={slot.id}
                      className="flex justify-between items-center p-3 border rounded-lg"
                    >
                      <span className="font-medium">
                        {new Date(slot.startTime).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {service.serviceType === "FIXED_PRICE" && service.packages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Packages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {service.packages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className="p-3 border rounded-lg"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium">{pkg.name}</span>
                        <span className="font-semibold">{formatCurrency(pkg.price)}</span>
                      </div>
                      {pkg.description && (
                        <p className="text-sm text-muted-foreground mt-1">{pkg.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Button className="w-full" size="lg">
            Book Service
          </Button>
        </div>
      </div>
    </div>
  )
}

