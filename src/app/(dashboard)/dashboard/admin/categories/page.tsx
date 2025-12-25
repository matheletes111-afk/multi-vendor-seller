import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"

export default async function CategoriesPage() {
  const session = await auth()
  
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }

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
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Categories</h1>
        <button className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90">
          Add Category
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Card key={category.id}>
            <CardHeader>
              <CardTitle>{category.name}</CardTitle>
              <CardDescription>{category.description || "No description"}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm">
                  Commission Rate: <span className="font-semibold">{category.commissionRate}%</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {category._count.products} products, {category._count.services} services
                </p>
                <p className="text-sm">
                  Status: <span className={category.isActive ? "text-green-600" : "text-red-600"}>
                    {category.isActive ? "Active" : "Inactive"}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

