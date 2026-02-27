import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils"

async function updatePlan(planId: string, data: { displayName?: string; description?: string; price?: number; maxProducts?: number | null; maxOrders?: number | null; features?: any }) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) redirect("/admin/subscriptions?error=unauthorized")
  try {
    await prisma.plan.update({ where: { id: planId }, data: { displayName: data.displayName, description: data.description, price: data.price, maxProducts: data.maxProducts, maxOrders: data.maxOrders, features: data.features } })
    revalidatePath("/admin/subscriptions")
    return { success: true }
  } catch (error: any) {
    return { error: `Failed to update plan: ${error.message || "Unknown error"}` }
  }
}

async function updatePlanForm(planId: string, formData: FormData) {
  "use server"
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) redirect("/admin/subscriptions?error=unauthorized")
  const data: any = { displayName: formData.get("displayName") as string, description: (formData.get("description") as string) || undefined }
  const priceStr = formData.get("price") as string
  if (priceStr) { const p = parseFloat(priceStr); if (!isNaN(p)) data.price = p }
  const maxProductsStr = formData.get("maxProducts") as string
  if (maxProductsStr === "unlimited" || maxProductsStr === "") data.maxProducts = null
  else if (maxProductsStr) { const n = parseInt(maxProductsStr); if (!isNaN(n)) data.maxProducts = n }
  const maxOrdersStr = formData.get("maxOrders") as string
  if (maxOrdersStr === "unlimited" || maxOrdersStr === "") data.maxOrders = null
  else if (maxOrdersStr) { const n = parseInt(maxOrdersStr); if (!isNaN(n)) data.maxOrders = n }
  const result = await updatePlan(planId, data)
  if (result.error) redirect(`/admin/subscriptions/edit/${planId}?error=${encodeURIComponent(result.error)}`)
  redirect("/admin/subscriptions?success=updated")
}

export default async function EditPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const session = await auth()

  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }

  const { id } = await params
  const searchParamsResolved = await searchParams

  const plan = await prisma.plan.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          subscriptions: true,
        },
      },
    },
  })

  if (!plan) {
    redirect("/admin/subscriptions?error=plan_not_found")
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Edit Subscription Plan</h1>
          <p className="text-muted-foreground">Update plan details and limits</p>
        </div>
        <Link href="/admin/subscriptions">
          <Button variant="outline">Back to Subscriptions</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{plan.displayName} Plan</CardTitle>
          <CardDescription>
            {plan._count.subscriptions} active subscription{plan._count.subscriptions !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {searchParamsResolved.error && (
            <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {decodeURIComponent(searchParamsResolved.error)}
            </div>
          )}
          {searchParamsResolved.success && (
            <div className="mb-4 rounded-md bg-green-500/15 p-3 text-sm text-green-600">
              Plan updated successfully!
            </div>
          )}

          <form action={updatePlanForm.bind(null, plan.id)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name *</Label>
              <Input
                id="displayName"
                name="displayName"
                defaultValue={plan.displayName}
                required
                placeholder="e.g., Premium"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                name="description"
                defaultValue={plan.description || ""}
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Plan description"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="price">Monthly Price *</Label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={plan.price}
                  required
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maxProducts">Max Products</Label>
                <Input
                  id="maxProducts"
                  name="maxProducts"
                  type="text"
                  defaultValue={plan.maxProducts === null ? "unlimited" : plan.maxProducts.toString()}
                  placeholder="unlimited or number"
                />
                <p className="text-xs text-muted-foreground">
                  Enter a number or "unlimited" for no limit
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxOrders">Max Orders per Month</Label>
                <Input
                  id="maxOrders"
                  name="maxOrders"
                  type="text"
                  defaultValue={plan.maxOrders === null ? "unlimited" : plan.maxOrders.toString()}
                  placeholder="unlimited or number"
                />
                <p className="text-xs text-muted-foreground">
                  Enter a number or "unlimited" for no limit
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <Button type="submit">Update Plan</Button>
              <Link href="/admin/subscriptions">
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
