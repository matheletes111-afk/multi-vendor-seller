"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"

export function CreatePlanClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [submitting, setSubmitting] = useState(false)
  const [planType, setPlanType] = useState("PRODUCT_SERVICE")
  const [planName, setPlanName] = useState("STANDARD")
  const [unlimitedProducts, setUnlimitedProducts] = useState(true)
  const [unlimitedOrders, setUnlimitedOrders] = useState(true)
  const [unlimitedRooms, setUnlimitedRooms] = useState(true)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    const form = e.currentTarget
    const formData = new FormData(form)

    const name = formData.get("name") as string
    const type = formData.get("type") as string
    const displayName = formData.get("displayName") as string
    const description = formData.get("description") as string || ""
    const priceStr = formData.get("price") as string
    const durationStr = formData.get("duration") as string
    const maxProductsStr = unlimitedProducts ? "unlimited" : (formData.get("maxProducts") as string)
    const maxOrdersStr = unlimitedOrders ? "unlimited" : (formData.get("maxOrders") as string)
    const maxRoomsStr = unlimitedRooms ? "unlimited" : (formData.get("maxRooms") as string)

    // Features checkboxes
    const features: Record<string, any> = {
      analytics: formData.get("feature_analytics") === "on" ? "advanced" : "basic",
      reviews: formData.get("feature_reviews") === "on",
      featured: formData.get("feature_featured") === "on",
      prioritySupport: formData.get("feature_support") === "on",
      customBranding: formData.get("feature_branding") === "on",
    }

    const data: any = {
      name,
      type,
      displayName,
      description,
      features,
    }

    const p = parseFloat(priceStr)
    if (!isNaN(p)) data.price = p

    const dur = parseInt(durationStr, 10)
    if (!isNaN(dur)) data.duration = dur

    if (maxProductsStr === "unlimited" || maxProductsStr === "") data.maxProducts = null
    else {
      const n = parseInt(maxProductsStr, 10)
      if (!isNaN(n)) data.maxProducts = n
    }

    if (maxOrdersStr === "unlimited" || maxOrdersStr === "") data.maxOrders = null
    else {
      const n = parseInt(maxOrdersStr, 10)
      if (!isNaN(n)) data.maxOrders = n
    }

    if (type === "HOTEL") {
      if (maxRoomsStr === "unlimited" || maxRoomsStr === "" || maxRoomsStr === undefined) data.maxRooms = null
      else {
        const n = parseInt(maxRoomsStr, 10)
        if (!isNaN(n)) data.maxRooms = n
      }
    }

    try {
      const res = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) {
        router.push(
          `/admin/subscriptions/new?error=${encodeURIComponent(json.error || "Creation failed")}`
        )
        return
      }
      router.push("/admin/subscriptions?success=created")
    } catch (err: any) {
      router.push(
        `/admin/subscriptions/new?error=${encodeURIComponent(err.message)}`
      )
    } finally {
      setSubmitting(false)
    }
  }

  const paramError = searchParams.get("error")

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-medium text-foreground">Create Subscription Plan</h1>
          <p className="text-muted-foreground">Add a new plan for sellers</p>
        </div>
        <Link href="/admin/subscriptions">
          <Button variant="outline">Back to Subscriptions</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plan Configuration</CardTitle>
          <CardDescription>
            Configure billing cycles, price, and feature limits
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paramError && (
            <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {decodeURIComponent(paramError)}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Plan Level *</Label>
                <select
                  id="name"
                  name="name"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                >
                  <option value="FREE">Free</option>
                  <option value="STANDARD">Standard</option>
                  <option value="PREMIUM">Premium</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Seller Type *</Label>
                <select
                  id="type"
                  name="type"
                  value={planType}
                  onChange={(e) => setPlanType(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                >
                  <option value="PRODUCT_SERVICE">Product & Service</option>
                  <option value="HOTEL">Hotels</option>
                  <option value="RESTAURANT">Restaurants</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name *</Label>
              <Input
                id="displayName"
                name="displayName"
                required
                placeholder="e.g., Premium Quarterly"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                name="description"
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Brief summary of plan benefits"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="price">Price *</Label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="29.99"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Plan Duration *</Label>
                <select
                  id="duration"
                  name="duration"
                  defaultValue="30"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                >
                  <option value="30">Monthly</option>
                  <option value="90">3 Months</option>
                  <option value="180">6 Months</option>
                  <option value="365">Yearly</option>
                </select>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2 p-4 rounded-xl border bg-muted/10">
                <Label className="text-sm font-medium text-foreground">
                  {planType === "HOTEL"
                    ? "Max Hotels Limit"
                    : planType === "RESTAURANT"
                      ? "Max Menu Items Limit"
                      : "Max Products / Services Limit"}
                </Label>
                <div className="flex rounded-lg bg-muted p-1 border">
                  <button
                    type="button"
                    onClick={() => setUnlimitedProducts(true)}
                    className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-all ${unlimitedProducts
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    Unlimited
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnlimitedProducts(false)}
                    className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-all ${!unlimitedProducts
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    Limited
                  </button>
                </div>
                {!unlimitedProducts && (
                  <div className="mt-2 animate-in fade-in-50 duration-200">
                    <Input
                      id="maxProducts"
                      name="maxProducts"
                      type="number"
                      min="1"
                      required
                      placeholder="Enter limit number"
                      className="h-10"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2 p-4 rounded-xl border bg-muted/10">
                <Label className="text-sm font-medium text-foreground">Max Orders per Month</Label>
                <div className="flex rounded-lg bg-muted p-1 border">
                  <button
                    type="button"
                    onClick={() => setUnlimitedOrders(true)}
                    className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-all ${unlimitedOrders
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    Unlimited
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnlimitedOrders(false)}
                    className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-all ${!unlimitedOrders
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    Limited
                  </button>
                </div>
                {!unlimitedOrders && (
                  <div className="mt-2 animate-in fade-in-50 duration-200">
                    <Input
                      id="maxOrders"
                      name="maxOrders"
                      type="number"
                      min="1"
                      required
                      placeholder="Enter limit number"
                      className="h-10"
                    />
                  </div>
                )}
              </div>

              {planType === "HOTEL" && (
                <div className="space-y-2 p-4 rounded-xl border bg-muted/10 col-span-2">
                  <Label className="text-sm font-medium text-foreground">Max Rooms Limit</Label>
                  <div className="flex rounded-lg bg-muted p-1 border">
                    <button
                      type="button"
                      onClick={() => setUnlimitedRooms(true)}
                      className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-all ${unlimitedRooms
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      Unlimited
                    </button>
                    <button
                      type="button"
                      onClick={() => setUnlimitedRooms(false)}
                      className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-all ${!unlimitedRooms
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      Limited
                    </button>
                  </div>
                  {!unlimitedRooms && (
                    <div className="mt-2 animate-in fade-in-50 duration-200">
                      <Input
                        id="maxRooms"
                        name="maxRooms"
                        type="number"
                        min="1"
                        required
                        placeholder="Enter limit number"
                        className="h-10"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t hidden">
              <Label className="text-base font-semibold">Features Enabled</Label>
              <div className="grid gap-4 md:grid-cols-2 pt-2">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="feature_reviews"
                    name="feature_reviews"
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="feature_reviews" className="cursor-pointer">
                    Enable Customer Reviews & Ratings
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="feature_featured"
                    name="feature_featured"
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="feature_featured" className="cursor-pointer">
                    Allow Featured Ads / Promotion
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="feature_analytics"
                    name="feature_analytics"
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="feature_analytics" className="cursor-pointer">
                    Advanced Dashboard Analytics
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="feature_support"
                    name="feature_support"
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="feature_support" className="cursor-pointer">
                    Priority Admin Support
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="feature_branding"
                    name="feature_branding"
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="feature_branding" className="cursor-pointer">
                    Custom Branding & Store Domain
                  </Label>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create Plan"}
              </Button>
              <Link href="/admin/subscriptions">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  )
}
