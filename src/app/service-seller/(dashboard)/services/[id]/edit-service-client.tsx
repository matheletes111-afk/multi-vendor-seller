"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Alert, AlertDescription } from "@/ui/alert"
import { Loader2 } from "lucide-react"
import { PricingFields } from "../pricing-fields"
import { ServiceMasterImageInput } from "../service-master-image-input"
import { ServiceGalleryImageInput } from "../service-gallery-image-input"
import { WeeklyAvailabilityFields } from "../weekly-availability-fields"

interface CategoryOption {
  id: string
  name: string
}

interface EditServiceClientProps {
  service: {
    id: string
    name: string
    description: string | null
    serviceCategoryId: string
    serviceType: "APPOINTMENT" | "FIXED_PRICE"
    basePrice: number | null
    discount: number | null
    hasGst: boolean | null
    duration: number | null
    isActive: boolean
    weeklyAvailability: any
  }
  categories: CategoryOption[]
  masterUrl: string | null
  galleryUrls: string[]
  initialError?: string
  initialSuccess?: string
}

export function EditServiceClient({
  service,
  categories,
  masterUrl: initialMasterUrl,
  galleryUrls: initialGalleryUrls,
  initialError,
  initialSuccess,
}: EditServiceClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [loadingText, setLoadingText] = useState("Updating service...")
  const [error, setError] = useState<string | null>(initialError || null)
  const [success, setSuccess] = useState<string | null>(initialSuccess || null)
  const errorRef = useRef<HTMLDivElement>(null)

  async function uploadFile(file: File): Promise<string> {
    const fd = new FormData()
    fd.append("file", file)

    let res: Response
    try {
      res = await fetch("/api/service-seller/upload", {
        method: "POST",
        body: fd,
      })
    } catch (networkErr: any) {
      throw new Error(
        `Network error uploading "${file.name}": ${networkErr?.message || "Could not reach server. Check your internet connection."}`
      )
    }

    let data: any = {}
    try {
      data = await res.json()
    } catch {
      throw new Error(`Server returned an invalid response while uploading "${file.name}" (status ${res.status}).`)
    }

    if (!res.ok) {
      throw new Error(
        data?.error
          ? `Upload failed for "${file.name}": ${data.error}`
          : `Upload failed for "${file.name}" (HTTP ${res.status}). Please try a smaller image or check the file format.`
      )
    }

    if (!data.url) {
      throw new Error(`Upload succeeded but no URL was returned for "${file.name}". Please try again.`)
    }

    return data.url
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const form = e.currentTarget
    const formData = new FormData(form)

    const name = (formData.get("name") as string)?.trim()
    const serviceCategoryId = (formData.get("serviceCategoryId") as string)?.trim()
    const serviceType = formData.get("serviceType") as "APPOINTMENT" | "FIXED_PRICE"

    if (!name || !serviceCategoryId || !serviceType) {
      setError("Please fill in all required fields (Service name, Category, and Service type).")
      errorRef.current?.scrollIntoView({ behavior: "smooth" })
      return
    }

    try {
      setLoading(true)

      // 1. Upload Master Image if a new file is chosen
      let masterUploadUrl: string | null = null
      const masterFile = formData.get("masterImage") as File | null
      if (masterFile && masterFile.size > 0 && typeof masterFile.arrayBuffer === "function") {
        setLoadingText("Uploading master image...")
        masterUploadUrl = await uploadFile(masterFile)
      }

      const masterUrlRaw = (formData.get("masterImageUrl") as string)?.trim() || ""
      const masterUrl = masterUploadUrl || masterUrlRaw || null
      const images = masterUrl ? [masterUrl] : []

      // 2. Upload Gallery Images if new files are chosen
      const galleryUploadUrls: string[] = []
      const galleryFiles = formData.getAll("serviceGalleryImages") as File[]
      const validGalleryFiles = galleryFiles.filter(
        (f) => f && f.size > 0 && typeof f.arrayBuffer === "function"
      )

      if (validGalleryFiles.length > 0) {
        setLoadingText(`Uploading gallery images (0/${validGalleryFiles.length})...`)
        for (let i = 0; i < validGalleryFiles.length; i++) {
          setLoadingText(`Uploading gallery image ${i + 1} of ${validGalleryFiles.length}...`)
          const uploadedUrl = await uploadFile(validGalleryFiles[i])
          galleryUploadUrls.push(uploadedUrl)
        }
      }

      const galleryRaw = (formData.get("galleryImageUrls") as string) || ""
      const linkGallery = galleryRaw
        .split(/[\n\r]+/)
        .map((u) => u.trim())
        .filter(Boolean)
      const galleryImages = Array.from(new Set([...linkGallery, ...galleryUploadUrls]))

      // 3. Process Pricing & Options
      const basePriceInput = formData.get("basePrice") as string
      const durationInput = formData.get("duration") as string
      const discountStr = (formData.get("discount") as string) || "0"
      const hasGst = (formData.get("hasGst") as string) === "true"
      const isActive = (formData.get("isActive") as string) === "true"

      let basePrice: number | undefined
      if (basePriceInput?.trim()) {
        const p = parseFloat(basePriceInput)
        if (!isNaN(p) && p > 0) basePrice = p
      }

      let duration: number | undefined
      if (durationInput?.trim()) {
        const p = parseInt(durationInput)
        if (!isNaN(p) && p > 0) duration = p
      }

      const discount = Math.max(0, isNaN(parseFloat(discountStr)) ? 0 : parseFloat(discountStr))

      let weeklyAvailability: unknown = undefined
      const waRaw = formData.get("weeklyAvailability") as string | null
      if (waRaw) {
        try {
          const parsed = JSON.parse(waRaw)
          if (Array.isArray(parsed) && parsed.length === 7) weeklyAvailability = parsed
        } catch {
          /* ignore */
        }
      }

      // 4. Submit PUT JSON payload to API
      setLoadingText("Updating service...")
      const payload = {
        name,
        description: (formData.get("description") as string)?.trim() || "",
        serviceCategoryId,
        serviceType,
        basePrice,
        hasGst,
        isActive,
        discount,
        duration,
        images,
        galleryImages,
        weeklyAvailability,
      }

      let res: Response
      try {
        res = await fetch(`/api/service-seller/services/${service.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } catch (networkErr: any) {
        throw new Error(
          `Network error: Could not reach the server. Please check your internet connection and try again.`
        )
      }

      let data: any = {}
      try {
        data = await res.json()
      } catch {
        throw new Error(`Server returned an unexpected response (status ${res.status}). Please try again.`)
      }

      if (!res.ok) {
        const serverMessage = data?.error || data?.message
        if (res.status === 401) {
          throw new Error("Your session has expired. Please log in again.")
        } else if (res.status === 403) {
          throw new Error(
            serverMessage ||
              "You do not have permission to update this service."
          )
        } else if (res.status === 404) {
          throw new Error("Service not found. It may have been deleted.")
        } else if (res.status === 400) {
          throw new Error(serverMessage || "Please check your form fields and try again.")
        } else if (serverMessage && serverMessage.includes("already exists")) {
          throw new Error("A service with this name already exists. Please use a different name.")
        } else {
          throw new Error(serverMessage || `Something went wrong (HTTP ${res.status}). Please try again.`)
        }
      }

      setSuccess("Service updated successfully! Redirecting…")
      setTimeout(() => {
        router.replace("/service-seller/services?success=Service+updated+successfully")
      }, 800)
    } catch (err: any) {
      setLoading(false)
      const message = err?.message || "An unexpected error occurred. Please try again."
      setError(message)
      errorRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }

  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
  const textareaClass =
    "flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"

  return (
    <div className="container mx-auto py-6 px-4 sm:px-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Edit Service</h1>
          <p className="text-muted-foreground mt-1">Update service information</p>
        </div>
        <Link href="/service-seller/services">
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            Back to Services
          </Button>
        </Link>
      </div>

      {error && (
        <div
          ref={errorRef}
          className="mb-6 flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="text-sm text-destructive">
            <p className="font-semibold mb-0.5">Failed to update service</p>
            <p>{error}</p>
            {error.toLowerCase().includes("session has expired") && (
              <Link href="/service-seller/login" className="mt-2 inline-block underline font-medium">
                Go to Login →
              </Link>
            )}
          </div>
        </div>
      )}
      {success && (
        <div className="mb-6 flex gap-3 rounded-lg border border-green-500/40 bg-green-50 dark:bg-green-950/30 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
          <p className="text-sm text-green-700 dark:text-green-400 font-medium">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Basic information</CardTitle>
            <CardDescription>Name, description, category and type</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Service name *</Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={service.name}
                placeholder="e.g. Home cleaning"
                className="max-w-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                name="description"
                className={textareaClass}
                placeholder="Describe your service"
                defaultValue={service.description || ""}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="serviceCategoryId">Category *</Label>
                <select
                  id="serviceCategoryId"
                  name="serviceCategoryId"
                  required
                  defaultValue={service.serviceCategoryId}
                  className={selectClass}
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="serviceType">Service type *</Label>
                <select
                  id="serviceType"
                  name="serviceType"
                  required
                  defaultValue={service.serviceType}
                  className={selectClass}
                >
                  <option value="">Select type</option>
                  <option value="APPOINTMENT">Appointment-based</option>
                  <option value="FIXED_PRICE">Fixed price</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Pricing & duration</CardTitle>
            <CardDescription>Base price, discount and duration for appointments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <PricingFields
              basePriceLabel="Base price (for fixed-price services)"
              defaultBasePrice={service.basePrice ?? 0}
              defaultDiscount={service.discount ?? 0}
              defaultHasGst={service.hasGst ?? true}
              showBasePrice={true}
              requireBasePrice={false}
            />
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes, for appointments)</Label>
              <Input
                id="duration"
                name="duration"
                type="number"
                min="1"
                defaultValue={service.duration ?? ""}
                placeholder="60"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Weekly availability</CardTitle>
            <CardDescription>
              Check the days you’re available and set shift times; uncheck a day to mark it closed
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <WeeklyAvailabilityFields defaultValue={service.weeklyAvailability} />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Images</CardTitle>
            <CardDescription>Master image and gallery — uploads run when you click Update service</CardDescription>
          </CardHeader>
          <CardContent className="space-y-10">
            <ServiceMasterImageInput
              defaultUrl={initialMasterUrl}
              hint="Shown in listings. Uploads when you click Update service."
            />
            <ServiceGalleryImageInput
              defaultUrls={initialGalleryUrls}
              hint="Additional photos — saved URLs show below; remove before update to delete from the service."
            />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <input
                id="isActive"
                name="isActive"
                type="checkbox"
                defaultChecked={service.isActive}
                value="true"
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="isActive" className="text-sm font-normal cursor-pointer">
                Active (service visible to customers)
              </Label>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <Link href="/service-seller/services" className="sm:order-2">
            <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={loading}>
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={loading} className="w-full sm:w-auto sm:order-1">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? loadingText : "Update service"}
          </Button>
        </div>
      </form>
    </div>
  )
}
