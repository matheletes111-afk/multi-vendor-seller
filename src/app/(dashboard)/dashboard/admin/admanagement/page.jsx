import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AddAdForm } from "@/components/admin/admanage/create-com"
import { EditAdForm } from "@/components/admin/admanage/edit-com"
import { DeleteAdButton } from "@/components/admin/admanage/delete-com"
import { AdImage } from "@/components/admin/admanage/ad-image"

export default async function AdManagementPage({
  searchParams,
}) {
  const session = await auth()
  
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }

  const params = await searchParams
  const ads = await prisma.adManagement.findMany({
    orderBy: { createdAt: "desc" },
  })

  // Serialize the data for client components
  const serializedAds = ads.map(ad => ({
    ...ad,
    createdAt: ad.createdAt.toISOString(),
    updatedAt: ad.updatedAt.toISOString(),
    image: ad.image || null
  }))

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ad Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage your advertisement images and content
          </p>
        </div>
        <AddAdForm />
      </div>

      {params?.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {decodeURIComponent(params.error)}
          </AlertDescription>
        </Alert>
      )}

      {params?.success && (
        <Alert>
          <AlertDescription>
            {decodeURIComponent(params.success)}
          </AlertDescription>
        </Alert>
      )}

      {serializedAds.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">No advertisements found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {serializedAds.map((ad) => (
            <Card key={ad.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle>{ad.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {ad.description || "No description"}
                    </CardDescription>
                  </div>
                  <Badge variant={ad.isActive ? "default" : "secondary"}>
                    {ad.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <AdImage image={ad.image} title={ad.title} />
                  
                  <div className="flex justify-end gap-2 pt-2">
                    <EditAdForm ad={ad} />
                    <DeleteAdButton
                      adId={ad.id}
                      adTitle={ad.title}
                    />
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