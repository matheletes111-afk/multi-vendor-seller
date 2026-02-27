import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"

async function approveSeller(sellerId: string) {
  "use server"
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) redirect("/admin/sellers?error=unauthorized")
  try {
    await prisma.seller.update({ where: { id: sellerId }, data: { isApproved: true } })
    revalidatePath("/admin/sellers")
    redirect("/admin/sellers?success=approved")
  } catch {
    redirect("/admin/sellers?error=failed")
  }
}

async function suspendSeller(sellerId: string) {
  "use server"
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) redirect("/admin/sellers?error=unauthorized")
  try {
    await prisma.seller.update({ where: { id: sellerId }, data: { isSuspended: true } })
    revalidatePath("/admin/sellers")
    redirect("/admin/sellers?success=suspended")
  } catch {
    redirect("/admin/sellers?error=failed")
  }
}

async function unsuspendSeller(sellerId: string) {
  "use server"
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) redirect("/admin/sellers?error=unauthorized")
  try {
    await prisma.seller.update({ where: { id: sellerId }, data: { isSuspended: false } })
    revalidatePath("/admin/sellers")
    redirect("/admin/sellers?success=unsuspended")
  } catch {
    redirect("/admin/sellers?error=failed")
  }
}

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
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Manage Sellers</h1>
        <p className="text-muted-foreground mt-2">
          View and manage all sellers on the platform
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sellers</CardTitle>
          <CardDescription>
            A list of all sellers registered on the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seller</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead>Stats</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sellers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No sellers found
                  </TableCell>
                </TableRow>
              ) : (
                sellers.map((seller) => (
                  <TableRow key={seller.id}>
                    <TableCell className="font-medium">
                      {seller.user.name || seller.user.email}
                    </TableCell>
                    <TableCell>{seller.store?.name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{seller.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge
                          variant={seller.isApproved ? "default" : "outline"}
                        >
                          {seller.isApproved ? "Approved" : "Pending"}
                        </Badge>
                        {seller.isSuspended && (
                          <Badge variant="destructive">Suspended</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {seller.subscription?.plan.displayName || (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {seller._count.products} products • {seller._count.services} services • {seller._count.orders} orders
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {!seller.isApproved && (
                          <form action={approveSeller.bind(null, seller.id)}>
                            <Button type="submit" size="sm">Approve</Button>
                          </form>
                        )}
                        {seller.isSuspended ? (
                          <form action={unsuspendSeller.bind(null, seller.id)}>
                            <Button type="submit" size="sm" variant="outline">
                              Unsuspend
                            </Button>
                          </form>
                        ) : (
                          <form action={suspendSeller.bind(null, seller.id)}>
                            <Button type="submit" size="sm" variant="destructive">
                              Suspend
                            </Button>
                          </form>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
