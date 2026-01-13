import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { updateStoreForm } from "@/server/actions/seller/update-store-form"
import { updateUserForm } from "@/server/actions/seller/update-user-form"

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const session = await auth()
  
  if (!session?.user || !isSeller(session.user)) {
    redirect("/login")
  }

  const params = await searchParams
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

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Store Information</CardTitle>
            <CardDescription>Manage your store details</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateStoreForm} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="storeName">Store Name *</Label>
                <Input
                  id="storeName"
                  name="storeName"
                  defaultValue={seller.store?.name || ""}
                  placeholder="Enter store name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={seller.store?.description || ""}
                  placeholder="Store description"
                  rows={4}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    defaultValue={seller.store?.phone || ""}
                    placeholder="Phone number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    name="website"
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
                  name="address"
                  defaultValue={seller.store?.address || ""}
                  placeholder="Street address"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    name="city"
                    defaultValue={seller.store?.city || ""}
                    placeholder="City"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    name="state"
                    defaultValue={seller.store?.state || ""}
                    placeholder="State"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode">Zip Code</Label>
                  <Input
                    id="zipCode"
                    name="zipCode"
                    defaultValue={seller.store?.zipCode || ""}
                    placeholder="Zip code"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  name="country"
                  defaultValue={seller.store?.country || ""}
                  placeholder="Country"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="logo">Logo URL</Label>
                  <Input
                    id="logo"
                    name="logo"
                    type="url"
                    defaultValue={seller.store?.logo || ""}
                    placeholder="https://example.com/logo.png"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="banner">Banner URL</Label>
                  <Input
                    id="banner"
                    name="banner"
                    type="url"
                    defaultValue={seller.store?.banner || ""}
                    placeholder="https://example.com/banner.png"
                  />
                </div>
              </div>
              <Button type="submit">Save Store Changes</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateUserForm} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="userEmail">Email</Label>
                <Input
                  id="userEmail"
                  type="email"
                  defaultValue={seller.user.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="userName">Name</Label>
                <Input
                  id="userName"
                  name="name"
                  defaultValue={seller.user.name || ""}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="userImage">Profile Image URL</Label>
                <Input
                  id="userImage"
                  name="image"
                  type="url"
                  defaultValue={seller.user.image || ""}
                  placeholder="https://example.com/profile.jpg"
                />
              </div>
              <div>
                <Label>Seller Type</Label>
                <p className="text-sm text-muted-foreground capitalize">{seller.type.toLowerCase()}</p>
              </div>
              <Button type="submit">Save Profile Changes</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

