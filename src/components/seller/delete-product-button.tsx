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
import { deleteProductForm } from "@/server/actions/products/delete-product-form"

interface DeleteProductButtonProps {
  productId: string
  productName: string
  orderItemsCount: number
  variantsCount: number
}

export function DeleteProductButton({
  productId,
  productName,
  orderItemsCount,
  variantsCount,
}: DeleteProductButtonProps) {
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete() {
    setIsDeleting(true)
    await deleteProductForm(productId)
    setOpen(false)
    setIsDeleting(false)
  }

  const hasOrders = orderItemsCount > 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" className="w-full">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Product</DialogTitle>
          <DialogDescription>
            {hasOrders ? (
              <>
                Warning: This product <strong>&quot;{productName}&quot;</strong> has {orderItemsCount} order{orderItemsCount > 1 ? "s" : ""}. 
                Deleting this product will permanently remove it and all associated data including {variantsCount} variant{variantsCount !== 1 ? "s" : ""}. 
                This action cannot be undone. Are you sure you want to proceed?
              </>
            ) : (
              <>
                Are you sure you want to permanently delete the product <strong>&quot;{productName}&quot;</strong>? 
                This will delete the product and all associated data including {variantsCount} variant{variantsCount !== 1 ? "s" : ""}. 
                <strong className="block mt-2 text-destructive">This action cannot be undone.</strong>
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
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Yes, Delete Permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

