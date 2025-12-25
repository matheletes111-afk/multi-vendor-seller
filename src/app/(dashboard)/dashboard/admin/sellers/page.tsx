import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/utils"

export default async function AdminSellersPage() {
  const session = await auth()
  
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }

  const sellers = await prisma.seller.findMany({
    include: {
      user: true,
      store: true,
      subscription: {
        include: {
          plan: true,
        },
      },
      _count: {
        select: {
          products: true,
          services: true,
          orders: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Manage Sellers</h1>

      <div className="space-y-4">
        {sellers.map((seller) => (
          <Card key={seller.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{seller.user.name || seller.user.email}</CardTitle>
                  <CardDescription>
                    {seller.store?.name || "No store name"} • {seller.type} Seller
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {!seller.isApproved && (
                    <form action={`/api/admin/sellers/${seller.id}/approve`}>
                      <Button type="submit" size="sm">Approve</Button>
                    </form>
                  )}
                  {seller.isSuspended ? (
                    <form action={`/api/admin/sellers/${seller.id}/unsuspend`}>
                      <Button type="submit" size="sm" variant="outline">Unsuspend</Button>
                    </form>
                  ) : (
                    <form action={`/api/admin/sellers/${seller.id}/suspend`}>
                      <Button type="submit" size="sm" variant="destructive">Suspend</Button>
                    </form>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-medium">
                    {seller.isApproved ? "Approved" : "Pending"} 
                    {seller.isSuspended && " • Suspended"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Subscription</p>
                  <p className="font-medium">
                    {seller.subscription?.plan.displayName || "None"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Stats</p>
                  <p className="font-medium">
                    {seller._count.products} products, {seller._count.services} services, {seller._count.orders} orders
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

