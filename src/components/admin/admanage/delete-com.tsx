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
import { useRouter } from "next/navigation"

export function DeleteAdButton({ adId, adTitle }) {
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/admanage/delete/${adId}`, {
        method: "DELETE",
      })

      const data = await res.json()

      if (data.success) {
        setOpen(false)
        router.refresh()
        router.push("/dashboard/admin/admanagement?success=Ad deleted successfully")
      } else {
        router.push(`/dashboard/admin/admanagement?error=${encodeURIComponent(data.error)}`)
      }
    } catch (error) {
      router.push("/dashboard/admin/admanagement?error=Failed to delete ad")
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
            Are you sure you want to delete the advertisement <strong>&quot;{adTitle}&quot;</strong>? This action cannot be undone.
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
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}