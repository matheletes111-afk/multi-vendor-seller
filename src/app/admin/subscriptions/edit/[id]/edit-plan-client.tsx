"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"

export function EditPlanClient({ planId }: { planId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [plan, setPlan] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/plans/${planId}`)
      .then((res) => {
        if (res.status === 404) return null
        if (!res.ok) throw new Error("Failed to fetch plan")
        return res.json()
      })
      .then((json) => {
        if (!cancelled) setPlan(json)
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
    e.preventDefault()
    if (!plan) return
    setSubmitting(true)
    const form = e.currentTarget
    const formData = new FormData(form)
    const displayName = formData.get("displayName") as string
    const description = (formData.get("description") as string) || undefined
    const priceStr = formData.get("price") as string
    const maxProductsStr = formData.get("maxProducts") as string
    const maxOrdersStr = formData.get("maxOrders") as string

    const data: any = { displayName, description }
    const p = parseFloat(priceStr)
    if (!isNaN(p)) data.price = p
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
    return <div className="py-8 text-center text-muted-foreground">Loading...</div>
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
                  defaultValue={
                    plan.maxProducts === null ? "unlimited" : plan.maxProducts.toString()
                  }
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
                  defaultValue={
                    plan.maxOrders === null ? "unlimited" : plan.maxOrders.toString()
                  }
                  placeholder="unlimited or number"
                />
                <p className="text-xs text-muted-foreground">
                  Enter a number or "unlimited" for no limit
                </p>
              </div>
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
