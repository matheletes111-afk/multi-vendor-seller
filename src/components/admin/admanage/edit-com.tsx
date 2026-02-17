"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Pencil, Upload, X } from "lucide-react"
import { useRouter } from "next/navigation"
import Image from "next/image"

export function EditAdForm({ ad }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [imagePreview, setImagePreview] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const router = useRouter()

  console.log("Edit form received ad:", ad)

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.type.startsWith("image/")) {
        setImageFile(file)
        const reader = new FileReader()
        reader.onloadend = () => {
          setImagePreview(reader.result)
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
    if (typeof window !== 'undefined') {
      const fileInput = document.getElementById("edit-image-upload")
      if (fileInput) fileInput.value = ""
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    
    try {
      const formData = new FormData(e.currentTarget)
      
      // Create new FormData for the API
      const submitData = new FormData()
      submitData.append("title", formData.get("title"))
      submitData.append("description", formData.get("description") || "")
      submitData.append("isActive", formData.get("isActive") === "on" ? "true" : "false")
      
      if (imageFile) {
        submitData.append("image", imageFile)
        console.log("Appending new image:", imageFile.name)
      }

      const url = `/api/admin/admanage/edit/${ad.id}`
      console.log("Sending PUT request to:", url)

      const res = await fetch(url, {
        method: "PUT",
        body: submitData,
      })

      const data = await res.json()
      console.log("Response status:", res.status)
      console.log("Response data:", data)

      if (data.success) {
        setOpen(false)
        router.refresh()
        // Use window.location for a hard refresh to show the success message
        window.location.href = "/dashboard/admin/admanagement?success=Ad updated successfully"
      } else {
        window.location.href = `/dashboard/admin/admanagement?error=${encodeURIComponent(data.error || "Update failed")}`
      }
    } catch (error) {
      console.error("Update error:", error)
      window.location.href = "/dashboard/admin/admanagement?error=Failed to update ad"
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
            <Input
              id="title"
              name="title"
              defaultValue={ad.title}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={ad.description || ""}
            />
          </div>

          <div className="space-y-2">
            <Label>Current Image</Label>
            {ad.image ? (
              <div className="relative w-full h-32 rounded-md border overflow-hidden">
                <Image
                  src={ad.image}
                  alt={ad.title}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <p className="text-sm text-gray-500">No image</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="image">New Image (Optional)</Label>
            <div className="flex flex-col gap-4">
              {!imagePreview ? (
                <label
                  htmlFor="edit-image-upload"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50"
                >
                  <Upload className="w-8 h-8 mb-2 text-gray-400" />
                  <p className="text-sm text-gray-500">Click to upload new image</p>
                  <input
                    id="edit-image-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </label>
              ) : (
                <div className="relative w-full h-32 rounded-md border overflow-hidden">
                  <Image
                    src={imagePreview}
                    alt="Preview"
                    fill
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full"
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
              defaultChecked={ad.isActive}
              className="h-4 w-4 rounded"
            />
            <Label htmlFor="isActive">Active</Label>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}