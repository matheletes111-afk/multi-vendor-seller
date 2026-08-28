"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { PageLoader } from "@/components/ui/page-loader"

export function EditPlanClient({ planId }: { planId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [plan, setPlan] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [unlimitedProducts, setUnlimitedProducts] = useState(true)
  const [unlimitedOrders, setUnlimitedOrders] = useState(true)
  const [unlimitedRooms, setUnlimitedRooms] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/plans/${planId}`)
      .then((res) => {
        if (res.status === 404) return null
        if (!res.ok) throw new Error("Failed to fetch plan")
        return res.json()
      })
      .then((json) => {
        if (!cancelled && json) {
          setPlan(json)
          setUnlimitedProducts(json.maxProducts === null)
          setUnlimitedOrders(json.maxOrders === null)
          setUnlimitedRooms(json.maxRooms === null)
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [planId])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    if (!plan) return
    e.preventDefault()
    setSubmitting(true)
    const form = e.currentTarget
    const formData = new FormData(form)
    const displayName = formData.get("displayName") as string
    const description = (formData.get("description") as string) || undefined
    const priceStr = formData.get("price") as string
    const durationStr = formData.get("duration") as string
    const maxProductsStr = unlimitedProducts ? "unlimited" : (formData.get("maxProducts") as string)
    const maxOrdersStr = unlimitedOrders ? "unlimited" : (formData.get("maxOrders") as string)
    const maxRoomsStr = unlimitedRooms ? "unlimited" : (formData.get("maxRooms") as string)

    const data: any = { displayName, description }
    const p = parseFloat(priceStr)
    if (!isNaN(p)) data.price = p
    if (durationStr) {
      const dur = parseInt(durationStr, 10)
      if (!isNaN(dur)) data.duration = dur
    }
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
    if (plan.type === "HOTEL") {
      if (maxRoomsStr === "unlimited" || maxRoomsStr === "" || maxRoomsStr === undefined) data.maxRooms = null
      else {
        const n = parseInt(maxRoomsStr, 10)
        if (!isNaN(n)) data.maxRooms = n
      }
    }

    try {
      const res = await fetch(`/api/admin/plans/${planId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) {
        router.push(
          `/admin/subscriptions/edit/${planId}?error=${encodeURIComponent(json.error || "Update failed")}`
        )
        return
      }
      router.push("/admin/subscriptions?success=updated")
    } catch (err: any) {
      router.push(
        `/admin/subscriptions/edit/${planId}?error=${encodeURIComponent(err.message)}`
      )
    } finally {
      setSubmitting(false)
    }
  }

  const paramError = searchParams.get("error")
  const paramSuccess = searchParams.get("success")

  if (loading && !plan) {
    return <PageLoader message="Loading plan…" />
  }
  if (error || !plan) {
    return (
      <div className="py-8 text-center text-destructive">
        {error || "Plan not found"}
      </div>
    )
  }

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-medium text-foreground">Edit Subscription Plan</h1>
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
            {plan._count?.subscriptions ?? 0} active subscription
            {(plan._count?.subscriptions ?? 0) !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paramError && (
            <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {decodeURIComponent(paramError)}
            </div>
          )}
          {paramSuccess && (
            <div className="mb-4 rounded-md bg-green-500/15 p-3 text-sm text-green-600">
              Plan updated successfully!
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
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
                <Label htmlFor="price">Price *</Label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={plan.price}
                  required
                  placeholder="0.00"
                  disabled={plan.price === 0}
                />
                {plan.price === 0 && (
                  <p className="text-xs text-muted-foreground font-medium">
                    The price of the default free plan (0 RS) cannot be changed.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Plan Duration *</Label>
                <select
                  id="duration"
                  name="duration"
                  defaultValue={plan.duration ?? 30}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  required
                >
                  <option value={30}>Monthly (30 Days)</option>
                  <option value={60}>2 Months (60 Days)</option>
                  <option value={90}>3 Months (90 Days)</option>
                  <option value={180}>6 Months (180 Days)</option>
                  <option value={365}>Yearly (365 Days)</option>
                </select>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2 p-4 rounded-xl border bg-muted/10">
                <Label className="text-sm font-medium text-foreground">
                  {plan.type === "HOTEL"
                    ? "Max Hotels Limit"
                    : plan.type === "RESTAURANT"
                      ? "Max Menu Items Limit"
                      : "Max Products / Services Limit"}
                </Label>
                <div className="flex rounded-lg bg-muted p-1 border">
                  <button
                    type="button"
                    onClick={() => setUnlimitedProducts(true)}
                    className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-all ${
                      unlimitedProducts
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Unlimited
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnlimitedProducts(false)}
                    className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-all ${
                      !unlimitedProducts
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
                      defaultValue={plan.maxProducts !== null ? plan.maxProducts.toString() : "10"}
                      className="h-10"
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {plan.type === "HOTEL"
                    ? "Maximum number of hotels the seller can register."
                    : plan.type === "RESTAURANT"
                      ? "Maximum number of menu/food items the seller can add."
                      : "Limit applies to Physical Products for product sellers and Services for service sellers."}
                </p>
              </div>

              <div className="space-y-2 p-4 rounded-xl border bg-muted/10">
                <Label className="text-sm font-medium text-foreground">Max Orders per Month</Label>
                <div className="flex rounded-lg bg-muted p-1 border">
                  <button
                    type="button"
                    onClick={() => setUnlimitedOrders(true)}
                    className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-all ${
                      unlimitedOrders
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Unlimited
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnlimitedOrders(false)}
                    className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-all ${
                      !unlimitedOrders
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
                      defaultValue={plan.maxOrders !== null ? plan.maxOrders.toString() : "100"}
                      className="h-10"
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Limit of orders that can be placed in a billing cycle.
                </p>
              </div>

              {plan.type === "HOTEL" && (
                <div className="space-y-2 p-4 rounded-xl border bg-muted/10 col-span-2">
                  <Label className="text-sm font-medium text-foreground">Max Rooms Limit</Label>
                  <div className="flex rounded-lg bg-muted p-1 border">
                    <button
                      type="button"
                      onClick={() => setUnlimitedRooms(true)}
                      className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-all ${
                        unlimitedRooms
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Unlimited
                    </button>
                    <button
                      type="button"
                      onClick={() => setUnlimitedRooms(false)}
                      className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-all ${
                        !unlimitedRooms
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
                        defaultValue={plan.maxRooms !== null && plan.maxRooms !== undefined ? plan.maxRooms.toString() : "50"}
                        className="h-10"
                      />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Maximum number of rooms the hotel seller can add.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Updating..." : "Update Plan"}
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
