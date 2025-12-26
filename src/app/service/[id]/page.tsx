import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"

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

  return (
    <div className="container mx-auto py-8">
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          {service.images.length > 0 ? (
            <img
              src={service.images[0]}
              alt={service.name}
              className="w-full h-96 object-cover rounded-lg"
            />
          ) : (
            <div className="w-full h-96 bg-muted rounded-lg flex items-center justify-center">
              No Image
            </div>
          )}
        </div>
        <div>
          <h1 className="text-3xl font-bold mb-2">{service.name}</h1>
          <p className="text-muted-foreground mb-4">{service.category.name}</p>
          {service.basePrice && (
            <p className="text-4xl font-bold mb-4">{formatCurrency(service.basePrice)}</p>
          )}
          {service.description && (
            <p className="text-muted-foreground mb-6">{service.description}</p>
          )}
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Service Type: {service.serviceType}</p>
              {service.duration && (
                <p className="text-sm text-muted-foreground">Duration: {service.duration} minutes</p>
              )}
            </div>
            {service.serviceType === "APPOINTMENT" && service.slots.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Available Slots:</p>
                <div className="space-y-2">
                  {service.slots.map((slot) => (
                    <div key={slot.id} className="p-2 border rounded">
                      {new Date(slot.startTime).toLocaleString()}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {service.serviceType === "FIXED_PRICE" && service.packages.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Packages:</p>
                <div className="space-y-2">
                  {service.packages.map((pkg) => (
                    <div key={pkg.id} className="p-2 border rounded">
                      <div className="flex justify-between">
                        <span className="font-medium">{pkg.name}</span>
                        <span>{formatCurrency(pkg.price)}</span>
                      </div>
                      {pkg.description && (
                        <p className="text-sm text-muted-foreground mt-1">{pkg.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Button className="w-full">Book Service</Button>
            <p className="text-sm text-muted-foreground">
              Sold by: {service.seller.store?.name || "Store"}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

