import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isServiceSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import { Alert, AlertDescription } from "@/ui/alert"

async function updateStore(data: { name?: string; description?: string; phone?: string; website?: string; address?: string; city?: string; state?: string; zipCode?: string; country?: string; logo?: string; banner?: string }) {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) return { error: "Unauthorized" }
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id }, include: { store: true } })
  if (!seller) return { error: "Seller not found" }
  const updateData: any = {}
  Object.keys(data).forEach((k) => { const v = data[k as keyof typeof data]; if (v !== undefined && v !== null && v !== "") updateData[k] = v })
  if (Object.keys(updateData).length === 0) return { error: "No data to update" }
  try {
    if (seller.store) await prisma.store.update({ where: { id: seller.store.id }, data: updateData })
    else await prisma.store.create({ data: { sellerId: seller.id, name: updateData.name || "My Store", ...updateData } })
    revalidatePath("/product-seller/settings")
    revalidatePath("/service-seller/settings")
    return { success: true }
  } catch (error: any) {
    return { error: `Failed to update store: ${error.message || "Unknown error"}` }
  }
}

async function updateUser(data: { name?: string; image?: string }) {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) return { error: "Unauthorized" }
  const updateData: any = {}
  if (data.name !== undefined && data.name !== null && data.name !== "") updateData.name = data.name
  if (data.image !== undefined && data.image !== null && data.image !== "") updateData.image = data.image
  if (Object.keys(updateData).length === 0) return { error: "No data to update" }
  try {
    await prisma.user.update({ where: { id: session.user.id }, data: updateData })
    revalidatePath("/product-seller/settings")
    revalidatePath("/service-seller/settings")
    return { success: true }
  } catch (error: any) {
    return { error: `Failed to update user: ${error.message || "Unknown error"}` }
  }
}

async function updateStoreForm(formData: FormData) {
  "use server"
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) redirect("/login?error=session_expired")
  const data = { name: formData.get("storeName") as string, description: formData.get("description") as string, phone: formData.get("phone") as string, website: formData.get("website") as string, address: formData.get("address") as string, city: formData.get("city") as string, state: formData.get("state") as string, zipCode: formData.get("zipCode") as string, country: formData.get("country") as string, logo: formData.get("logo") as string, banner: formData.get("banner") as string }
  const result = await updateStore(data)
  if (result.error) redirect(`/service-seller/settings?error=${encodeURIComponent(typeof result.error === "string" ? result.error : "Failed")}`)
  redirect("/service-seller/settings?success=Store information updated successfully")
}

async function updateUserForm(formData: FormData) {
  "use server"
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) redirect("/login?error=session_expired")
  const data = { name: formData.get("name") as string, image: formData.get("image") as string }
  const result = await updateUser(data)
  if (result.error) redirect(`/service-seller/settings?error=${encodeURIComponent(typeof result.error === "string" ? result.error : "Failed")}`)
  redirect("/service-seller/settings?success=Profile updated successfully")
}

export default async function ServiceSellerSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const session = await auth()

  if (!session?.user || !isServiceSeller(session.user)) {
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
