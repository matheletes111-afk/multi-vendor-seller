import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default async function SettingsPage() {
  const session = await auth()
  
  if (!session?.user || !isSeller(session.user)) {
    redirect("/login")
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    include: {
      store: true,
      user: true,
    },
  })

  if (!seller) {
    redirect("/register")
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Store Settings</h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Store Information</CardTitle>
            <CardDescription>Manage your store details</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="storeName">Store Name</Label>
                <Input
                  id="storeName"
                  defaultValue={seller.store?.name || ""}
                  placeholder="Enter store name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  defaultValue={seller.store?.description || ""}
                  placeholder="Store description"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    defaultValue={seller.store?.phone || ""}
                    placeholder="Phone number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    type="url"
                    defaultValue={seller.store?.website || ""}
                    placeholder="https://example.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  defaultValue={seller.store?.address || ""}
                  placeholder="Street address"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    defaultValue={seller.store?.city || ""}
                    placeholder="City"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    defaultValue={seller.store?.state || ""}
                    placeholder="State"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode">Zip Code</Label>
                  <Input
                    id="zipCode"
                    defaultValue={seller.store?.zipCode || ""}
                    placeholder="Zip code"
                  />
                </div>
              </div>
              <Button type="submit">Save Changes</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label>Email</Label>
                <p className="text-sm text-muted-foreground">{seller.user.email}</p>
              </div>
              <div>
                <Label>Name</Label>
                <p className="text-sm text-muted-foreground">{seller.user.name || "Not set"}</p>
              </div>
              <div>
                <Label>Seller Type</Label>
                <p className="text-sm text-muted-foreground capitalize">{seller.type.toLowerCase()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

