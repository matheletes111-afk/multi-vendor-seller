"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Upload, X } from "lucide-react"
import { useRouter } from "next/navigation"
import Image from "next/image"

export function AddAdForm() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const router = useRouter()

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.type.startsWith("image/")) {
        setImageFile(file)
        const reader = new FileReader()
        reader.onloadend = () => {
          setImagePreview(reader.result as string)
        }
        reader.readAsDataURL(file)
      } else {
        alert("Please select an image file")
      }
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
    // Fix: Check if we're in browser and element exists
    if (typeof window !== 'undefined') {
      const fileInput = document.getElementById("image-upload") as HTMLInputElement
      if (fileInput) {
        fileInput.value = ""
      }
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    
    try {
      const formData = new FormData(e.currentTarget)
      const title = formData.get("title") as string | null
      const description = formData.get("description") as string | null
      const isActive = formData.get("isActive") === "on"

      const submitFormData = new FormData()
      submitFormData.append("title", title ?? "")
      submitFormData.append("description", description ?? "")
      submitFormData.append("isActive", String(isActive))
      
      if (imageFile) {
        submitFormData.append("image", imageFile)
      }

      const res = await fetch("/api/admin/admanage/create", {
        method: "POST",
        body: submitFormData,
      })

      const data = await res.json()

      if (data.success) {
        setOpen(false)
        setImagePreview(null)
        setImageFile(null)
        router.refresh()
        router.push("/dashboard/admin/admanagement?success=Ad created successfully")
      } else {
        router.push(`/dashboard/admin/admanagement?error=${encodeURIComponent(data.error)}`)
      }
    } catch (error) {
      router.push("/dashboard/admin/admanagement?error=Failed to create ad")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setOpen(false)
    setImagePreview(null)
    setImageFile(null)
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
          <SheetDescription>
            Create a new advertisement image and content
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              name="title"
              placeholder="e.g., Summer Sale Banner"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Advertisement description"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image">Image</Label>
            <div className="flex flex-col gap-4">
              {!imagePreview ? (
                <div className="flex items-center justify-center w-full">
                  <label
                    htmlFor="image-upload"
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-2 text-gray-400" />
                      <p className="text-sm text-gray-500">Click to upload image</p>
                    </div>
                    <input
                      id="image-upload"
                      name="image"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageChange}
                    />
                  </label>
                </div>
              ) : (
                <div className="relative w-full h-48 rounded-md overflow-hidden">
                  <Image
                    src={imagePreview}
                    alt="Preview"
                    fill
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              id="isActive"
              name="isActive"
              type="checkbox"
              defaultChecked
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="isActive" className="text-sm font-normal">
              Active
            </Label>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Creating..." : "Create Advertisement"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}