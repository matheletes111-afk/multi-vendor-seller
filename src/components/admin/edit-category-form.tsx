"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Pencil } from "lucide-react"
import { updateCategoryForm } from "@/server/actions/admin/update-category-form"

interface Category {
  id: string
  name: string
  description: string | null
  image: string | null
  commissionRate: number
  isActive: boolean
}

interface EditCategoryFormProps {
  category: Category
}

export function EditCategoryForm({ category }: EditCategoryFormProps) {
  const [open, setOpen] = useState(false)

  async function handleSubmit(formData: FormData) {
    await updateCategoryForm(category.id, formData)
    setOpen(false)
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
          <SheetTitle>Edit Category</SheetTitle>
          <SheetDescription>
            Update category information and status
          </SheetDescription>
        </SheetHeader>
        <form action={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Category Name *</Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g., Electronics"
              defaultValue={category.name}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Category description"
              rows={4}
              defaultValue={category.description || ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image">Image URL</Label>
            <Input
              id="image"
              name="image"
              type="url"
              placeholder="https://example.com/image.jpg"
              defaultValue={category.image || ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="commissionRate">Commission Rate (%)</Label>
            <Input
              id="commissionRate"
              name="commissionRate"
              type="number"
              step="0.1"
              min="0"
              max="100"
              defaultValue={category.commissionRate}
              placeholder="10.0"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              id="isActive"
              name="isActive"
              type="checkbox"
              defaultChecked={category.isActive}
              value="true"
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="isActive" className="text-sm font-normal">
              Active
            </Label>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              Update Category
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

