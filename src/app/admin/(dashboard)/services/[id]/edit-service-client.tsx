"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select"
import { Alert, AlertDescription } from "@/ui/alert"
import { PageLoader } from "@/components/ui/page-loader"
import { ArrowLeft, Save, AlertCircle } from "lucide-react"

export function EditServiceClient({ serviceId }: { serviceId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fields
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [serviceCategoryId, setServiceCategoryId] = useState("")
  const [serviceType, setServiceType] = useState<"APPOINTMENT" | "FIXED_PRICE">("FIXED_PRICE")
  const [basePrice, setBasePrice] = useState<number | "">("")
  const [discount, setDiscount] = useState(0)
  const [duration, setDuration] = useState<number | "">("")
  const [isActive, setIsActive] = useState(true)

  const [categories, setCategories] = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/services/${serviceId}`).then((r) => r.json()),
      fetch("/api/service-categories").then((r) => r.json().catch(() => [])),
    ])
      .then(([service, cats]) => {
        if (service.error) {
          setError(service.error)
        } else {
          setName(service.name)
          setDescription(service.description || "")
          setServiceCategoryId(service.serviceCategoryId)
          setServiceType(service.serviceType)
          setBasePrice(service.basePrice !== null ? service.basePrice : "")
          setDiscount(service.discount || 0)
          setDuration(service.duration !== null ? service.duration : "")
          setIsActive(service.isActive)
        }
        setCategories(Array.isArray(cats) ? cats : [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [serviceId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError("Name is required")
    if (!serviceCategoryId) return setError("Category is required")

    if (serviceType === "FIXED_PRICE") {
      if (basePrice === "" || isNaN(Number(basePrice)) || Number(basePrice) <= 0) {
        return setError("Base Price is required and must be greater than 0 for Fixed Price services")
      }
      if (discount < 0 || discount > Number(basePrice)) {
        return setError("Discount must be between 0 and Base Price")
      }
    }

    if (serviceType === "APPOINTMENT" && (duration === "" || isNaN(Number(duration)) || Number(duration) <= 0)) {
      return setError("Duration is required and must be greater than 0 for Appointment services")
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/services/${serviceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          serviceCategoryId,
          serviceType,
          basePrice: serviceType === "FIXED_PRICE" ? Number(basePrice) : null,
          discount: serviceType === "FIXED_PRICE" ? discount : 0,
          duration: serviceType === "APPOINTMENT" ? Number(duration) : null,
          isActive,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Update failed")

      router.push("/admin/services?success=Service+updated+successfully")
      router.refresh()
    } catch (e: any) {
      setError(e.message)
      window.scrollTo(0, 0)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoader message="Loading editor..." />

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="rounded-full h-10 w-10 border-muted" onClick={() => router.push("/admin/services")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Edit Service (Admin Mode)</h1>
          <p className="text-muted-foreground text-sm font-medium">Bypass seller checks to update core properties.</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="border-none shadow-xl bg-destructive/10 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <AlertDescription className="font-semibold">{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="rounded-[2rem] border-none shadow-2xl overflow-hidden bg-background">
          <CardHeader>
            <CardTitle className="text-lg font-bold uppercase tracking-wider text-primary/80">Service Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="srvName" className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Service Name</Label>
              <Input
                id="srvName"
                className="rounded-2xl h-12 bg-background border-muted"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Service name..."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="srvDesc" className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Description</Label>
              <Textarea
                id="srvDesc"
                className="rounded-2xl min-h-[120px] bg-background border-muted"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Category</Label>
                <Select value={serviceCategoryId} onValueChange={setServiceCategoryId}>
                  <SelectTrigger className="rounded-2xl h-12 bg-background border-muted">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-xl">
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Service Type</Label>
                <Select value={serviceType} onValueChange={(val: any) => setServiceType(val)}>
                  <SelectTrigger className="rounded-2xl h-12 bg-background border-muted">
                    <SelectValue placeholder="Select Type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-xl">
                    <SelectItem value="FIXED_PRICE">Fixed Price</SelectItem>
                    <SelectItem value="APPOINTMENT">Appointment Based</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Active Status</Label>
                <Select value={isActive ? "active" : "inactive"} onValueChange={(val) => setIsActive(val === "active")}>
                  <SelectTrigger className="rounded-2xl h-12 bg-background border-muted">
                    <SelectValue placeholder="Active Status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-xl">
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {serviceType === "APPOINTMENT" ? (
                <div className="space-y-1.5 animate-in fade-in duration-300">
                  <Label htmlFor="srvDuration" className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Duration (Minutes)</Label>
                  <Input
                    id="srvDuration"
                    type="number"
                    className="rounded-2xl h-12 bg-background border-muted"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value ? parseInt(e.target.value, 10) : "")}
                    placeholder="e.g. 60"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-300">
                  <div className="space-y-1.5">
                    <Label htmlFor="srvPrice" className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Base Price ($)</Label>
                    <Input
                      id="srvPrice"
                      type="number"
                      step="0.01"
                      className="rounded-2xl h-12 bg-background border-muted"
                      value={basePrice}
                      onChange={(e) => setBasePrice(e.target.value ? parseFloat(e.target.value) : "")}
                      placeholder="Price"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="srvDisc" className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Discount ($)</Label>
                    <Input
                      id="srvDisc"
                      type="number"
                      step="0.01"
                      className="rounded-2xl h-12 bg-background border-muted"
                      value={discount}
                      onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="Discount"
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" className="rounded-full px-6 h-12" onClick={() => router.push("/admin/services")} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" className="rounded-full px-8 h-12 font-bold shadow-lg shadow-primary/20" disabled={saving}>
            <Save className="h-4 w-4 mr-2" /> {saving ? "Saving Changes..." : "Save Service Settings"}
          </Button>
        </div>
      </form>
    </div>
  )
}
