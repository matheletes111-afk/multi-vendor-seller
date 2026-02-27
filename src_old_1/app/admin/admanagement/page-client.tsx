"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/ui/sheet"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Alert, AlertDescription } from "@/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/ui/dialog"
import { Plus, Pencil, Trash2, Upload, X, ImageIcon } from "lucide-react"

type Ad = {
  id: string
  title: string
  description?: string | null
  image?: string | null
  isActive: boolean
}

export function AdManagementPageClient({
  ads,
  params,
}: {
  ads: Ad[]
  params: { error?: string; success?: string }
}) {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ad Management</h1>
          <p className="text-muted-foreground mt-2">Manage your advertisement images and content</p>
        </div>
        <AddAdForm />
      </div>

      {params?.error && (
        <Alert variant="destructive">
          <AlertDescription>{decodeURIComponent(params.error)}</AlertDescription>
        </Alert>
      )}
      {params?.success && (
        <Alert>
          <AlertDescription>{decodeURIComponent(params.success)}</AlertDescription>
        </Alert>
      )}

      {ads.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">No advertisements found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ads.map((ad) => (
            <Card key={ad.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle>{ad.title}</CardTitle>
                    <CardDescription className="mt-1">{ad.description || "No description"}</CardDescription>
                  </div>
                  <Badge variant={ad.isActive ? "default" : "secondary"}>{ad.isActive ? "Active" : "Inactive"}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <AdImage image={ad.image} title={ad.title} />
                  <div className="flex justify-end gap-2 pt-2">
                    <EditAdForm ad={ad} />
                    <DeleteAdButton adId={ad.id} adTitle={ad.title} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function AdImage({ image, title }: { image: string | null | undefined; title: string }) {
  const [imageError, setImageError] = useState(false)
  if (!image || imageError) {
    return (
      <div className="w-full h-40 rounded-md bg-gray-100 flex items-center justify-center border">
        <ImageIcon className="h-10 w-10 text-gray-400" />
      </div>
    )
  }
  return (
    <div className="relative w-full h-40 rounded-md overflow-hidden bg-gray-100 border">
      <Image src={image} alt={title} fill sizes="(max-width: 768px) 100vw, 50vw, 33vw" className="object-cover" onError={() => setImageError(true)} />
    </div>
  )
}

function AddAdForm() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const router = useRouter()

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file?.type.startsWith("image/")) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => setImagePreview(reader.result as string)
      reader.readAsDataURL(file)
    } else if (file) alert("Please select an image file")
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (typeof window !== "undefined") {
      const el = document.getElementById("image-upload") as HTMLInputElement
      if (el) el.value = ""
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    try {
      const formData = new FormData(e.currentTarget)
      const submitFormData = new FormData()
      submitFormData.append("title", (formData.get("title") as string) ?? "")
      submitFormData.append("description", (formData.get("description") as string) ?? "")
      submitFormData.append("isActive", formData.get("isActive") === "on" ? "true" : "false")
      if (imageFile) submitFormData.append("image", imageFile)

      const res = await fetch("/api/admin/admanage/create", { method: "POST", body: submitFormData })
      const data = await res.json()
      if (data.success) {
        setOpen(false)
        setImagePreview(null)
        setImageFile(null)
        router.refresh()
        router.push("/admin/admanagement?success=Ad created successfully")
      } else {
        router.push(`/admin/admanagement?error=${encodeURIComponent(data.error)}`)
      }
    } catch {
      router.push("/admin/admanagement?error=Failed to create ad")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Advertisement
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add New Advertisement</SheetTitle>
          <SheetDescription>Create a new advertisement image and content</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" name="title" placeholder="e.g., Summer Sale Banner" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" placeholder="Advertisement description" rows={4} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="image">Image</Label>
            {!imagePreview ? (
              <label htmlFor="image-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
                <Upload className="w-8 h-8 mb-2 text-gray-400" />
                <p className="text-sm text-gray-500">Click to upload image</p>
                <input id="image-upload" name="image" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </label>
            ) : (
              <div className="relative w-full h-48 rounded-md overflow-hidden">
                <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                <button type="button" onClick={removeImage} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <input id="isActive" name="isActive" type="checkbox" defaultChecked className="h-4 w-4 rounded border-gray-300" />
            <Label htmlFor="isActive" className="text-sm font-normal">Active</Label>
          </div>
          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1" disabled={loading}>{loading ? "Creating..." : "Create Advertisement"}</Button>
            <Button type="button" variant="outline" onClick={() => { setOpen(false); setImagePreview(null); setImageFile(null) }} disabled={loading}>Cancel</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function EditAdForm({ ad }: { ad: Ad }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const router = useRouter()

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file?.type.startsWith("image/")) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => setImagePreview(reader.result as string)
      reader.readAsDataURL(file)
    } else if (file) alert("Please select an image file")
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (typeof window !== "undefined") {
      const el = document.getElementById("edit-image-upload") as HTMLInputElement
      if (el) el.value = ""
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    try {
      const formData = new FormData(e.currentTarget)
      const submitData = new FormData()
      submitData.append("title", (formData.get("title") as string) ?? "")
      submitData.append("description", (formData.get("description") as string) ?? "")
      submitData.append("isActive", formData.get("isActive") === "on" ? "true" : "false")
      if (imageFile) submitData.append("image", imageFile)

      const res = await fetch(`/api/admin/admanage/edit/${ad.id}`, { method: "PUT", body: submitData })
      const data = await res.json()
      if (data.success) {
        setOpen(false)
        router.refresh()
        window.location.href = "/admin/admanagement?success=Ad updated successfully"
      } else {
        window.location.href = `/admin/admanagement?error=${encodeURIComponent(data.error || "Update failed")}`
      }
    } catch {
      window.location.href = "/admin/admanagement?error=Failed to update ad"
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit Advertisement</SheetTitle>
          <SheetDescription>Update advertisement information</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" name="title" defaultValue={ad.title} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} defaultValue={ad.description || ""} />
          </div>
          {ad.image && (
            <div className="relative w-full h-32 rounded-md border overflow-hidden">
              <Image src={ad.image} alt={ad.title} fill className="object-cover" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="edit-image-upload">New Image (Optional)</Label>
            {!imagePreview ? (
              <label htmlFor="edit-image-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
                <Upload className="w-8 h-8 mb-2 text-gray-400" />
                <p className="text-sm text-gray-500">Click to upload new image</p>
                <input id="edit-image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </label>
            ) : (
              <div className="relative w-full h-32 rounded-md border overflow-hidden">
                <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                <button type="button" onClick={removeImage} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <input id="isActive" name="isActive" type="checkbox" defaultChecked={ad.isActive} className="h-4 w-4 rounded" />
            <Label htmlFor="isActive">Active</Label>
          </div>
          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading}>{loading ? "Updating..." : "Update"}</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function DeleteAdButton({ adId, adTitle }: { adId: string; adTitle: string }) {
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/admanage/delete/${adId}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        setOpen(false)
        router.refresh()
        router.push("/admin/admanagement?success=Ad deleted successfully")
      } else {
        router.push(`/admin/admanagement?error=${encodeURIComponent(data.error)}`)
      }
    } catch {
      router.push("/admin/admanagement?error=Failed to delete ad")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Advertisement</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{adTitle}&quot;? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isDeleting}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>{isDeleting ? "Deleting..." : "Delete"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
