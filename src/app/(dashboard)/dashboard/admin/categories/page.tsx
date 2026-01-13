import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Package, Briefcase } from "lucide-react"
import { AddCategoryForm } from "@/components/admin/add-category-form"

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const session = await auth()
  
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }

  const params = await searchParams
  const categories = await prisma.category.findMany({
    include: {
      _count: {
        select: {
          products: true,
          services: true,
        },
      },
    },
    orderBy: { name: "asc" },
  })

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground mt-2">
            Manage product and service categories
          </p>
        </div>
        <AddCategoryForm />
      </div>

      {params.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {decodeURIComponent(params.error)}
          </AlertDescription>
        </Alert>
      )}

      {params.success && (
        <Alert>
          <AlertDescription>
            {decodeURIComponent(params.success)}
          </AlertDescription>
        </Alert>
      )}

      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">No categories found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Card key={category.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle>{category.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {category.description || "No description"}
                    </CardDescription>
                  </div>
                  <Badge variant={category.isActive ? "default" : "secondary"}>
                    {category.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Commission Rate</p>
                    <p className="text-lg font-semibold">{category.commissionRate}%</p>
                  </div>
                  <Separator />
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{category._count.products} products</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{category._count.services} services</span>
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

