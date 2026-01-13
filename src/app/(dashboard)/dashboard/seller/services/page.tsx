import { getSellerServices } from "@/server/actions/services/get-services"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { DeleteServiceButton } from "@/components/seller/delete-service-button"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils"
import { Edit } from "lucide-react"

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const services = await getSellerServices()
  const params = await searchParams

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Services</h1>
          <p className="text-muted-foreground">Manage your service listings</p>
        </div>
        <Link href="/dashboard/seller/services/new">
          <Button>Add Service</Button>
        </Link>
      </div>

      {params.error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>
            {decodeURIComponent(params.error)}
          </AlertDescription>
        </Alert>
      )}

      {params.success && (
        <Alert className="mb-6">
          <AlertDescription>
            {decodeURIComponent(params.success)}
          </AlertDescription>
        </Alert>
      )}

      {services.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No services yet</p>
            <Link href="/dashboard/seller/services/new">
              <Button>Create Your First Service</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Card key={service.id}>
              <CardHeader>
                <CardTitle>{service.name}</CardTitle>
                <CardDescription>
                  {service.category.name} • {service.serviceType}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {service.basePrice && (
                    <p className="text-2xl font-bold">{formatCurrency(service.basePrice)}</p>
                  )}
                  {service.duration && (
                    <p className="text-sm text-muted-foreground">Duration: {service.duration} min</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Slots: {service.slots.length} | Packages: {service.packages.length}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Bookings: {service._count.orderItems} | Reviews: {service._count.reviews}
                  </p>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <Link href={`/dashboard/seller/services/${service.id}`}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </Link>
                    </Button>
                    <div className="flex-1">
                    <div className="flex-1">
                      <DeleteServiceButton
                        serviceId={service.id}
                        serviceName={service.name}
                        orderItemsCount={service._count.orderItems}
                      />
                    </div>
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

