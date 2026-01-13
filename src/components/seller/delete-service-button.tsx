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
import { deleteServiceForm } from "@/server/actions/services/delete-service-form"

interface DeleteServiceButtonProps {
  serviceId: string
  serviceName: string
  orderItemsCount: number
}

export function DeleteServiceButton({
  serviceId,
  serviceName,
  orderItemsCount,
}: DeleteServiceButtonProps) {
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete() {
    setIsDeleting(true)
    await deleteServiceForm(serviceId)
    setOpen(false)
    setIsDeleting(false)
  }

  const hasBookings = orderItemsCount > 0

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
          <DialogTitle>Delete Service</DialogTitle>
          <DialogDescription>
            {hasBookings ? (
              <>
                Warning: This service <strong>&quot;{serviceName}&quot;</strong> has {orderItemsCount} booking{orderItemsCount > 1 ? "s" : ""}. 
                Deleting this service will permanently remove it and all associated data including slots and packages. 
                This action cannot be undone. Are you sure you want to proceed?
              </>
            ) : (
              <>
                Are you sure you want to permanently delete the service <strong>&quot;{serviceName}&quot;</strong>? 
                This will delete the service and all associated data including slots and packages. 
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

