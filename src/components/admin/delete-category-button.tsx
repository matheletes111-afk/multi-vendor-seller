"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Trash2 } from "lucide-react"
import { deleteCategoryForm } from "@/server/actions/admin/delete-category-form"

interface DeleteCategoryButtonProps {
  categoryId: string
  categoryName: string
  productCount: number
  serviceCount: number
}

export function DeleteCategoryButton({
  categoryId,
  categoryName,
  productCount,
  serviceCount,
}: DeleteCategoryButtonProps) {
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete() {
    setIsDeleting(true)
    await deleteCategoryForm(categoryId)
    setOpen(false)
    setIsDeleting(false)
  }

  const hasUsage = productCount > 0 || serviceCount > 0

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
          <DialogTitle>Delete Category</DialogTitle>
          <DialogDescription>
            {hasUsage ? (
              <>
                Cannot delete category <strong>&quot;{categoryName}&quot;</strong> because it is currently being used by{" "}
                {productCount > 0 && (
                  <strong>{productCount} product{productCount > 1 ? "s" : ""}</strong>
                )}
                {productCount > 0 && serviceCount > 0 && " and "}
                {serviceCount > 0 && (
                  <strong>{serviceCount} service{serviceCount > 1 ? "s" : ""}</strong>
                )}
                . Please remove or reassign all products and services before deleting this category.
              </>
            ) : (
              <>
                Are you sure you want to delete the category <strong>&quot;{categoryName}&quot;</strong>? This action cannot be undone.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          {!hasUsage && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

