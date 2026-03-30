"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { Button } from "@/ui/button"
import { cn } from "@/lib/utils"
import { Check, LayoutGrid } from "lucide-react"

export type CategoryPickItem = {
  id: string
  name: string
  slug: string
  image: string | null
  mobileIcon: string | null
}

type CategoryInterestModalProps = {
  open: boolean
  categories: CategoryPickItem[]
  initialSelectedIds: string[]
  onCompleted: () => void
}

export function CategoryInterestModal({
  open,
  categories,
  initialSelectedIds,
  onCompleted,
}: CategoryInterestModalProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setSelected(new Set(initialSelectedIds))
      setError(null)
    }
  }, [open, initialSelectedIds])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function save() {
    const categoryIds = [...selected]
    if (categoryIds.length === 0) {
      setError("Choose at least one category.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/customer/category-interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ categoryIds }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? "Could not save.")
        return
      }
      onCompleted()
    } catch {
      setError("Could not save. Try again.")
    } finally {
      setSaving(false)
    }
  }

  async function skip() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/customer/category-interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ skip: true }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError(data.error ?? "Could not continue.")
        return
      }
      onCompleted()
    } catch {
      setError("Could not continue. Try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={() => {
        /* closing is handled only after Save / Skip */
      }}
    >
      <DialogContent
        hideCloseButton
        className="max-h-[min(90vh,720px)] w-[min(100vw-1.5rem,560px)] gap-0 overflow-hidden p-0 sm:max-w-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-1 border-b border-slate-200 px-4 py-4 sm:px-6">
          <DialogTitle className="text-lg sm:text-xl">Pick categories you like</DialogTitle>
          <DialogDescription className="text-sm">
            We&apos;ll show products from these categories on your home page. You can change this later from your profile when we add that link.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(52vh,420px)] overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
          {categories.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">No categories available.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
              {categories.map((cat) => {
                const isOn = selected.has(cat.id)
                const img = cat.image || cat.mobileIcon
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggle(cat.id)}
                    className={cn(
                      "relative flex flex-col overflow-hidden rounded-xl border-2 bg-white text-left transition-all",
                      isOn ? "border-amber-500 ring-2 ring-amber-200" : "border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <div className="relative aspect-[4/3] w-full bg-slate-100">
                      {img ? (
                        <img src={img} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <LayoutGrid className="h-10 w-10 text-slate-300" />
                        </div>
                      )}
                      {isOn && (
                        <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-white shadow">
                          <Check className="h-4 w-4" />
                        </span>
                      )}
                    </div>
                    <span className="line-clamp-2 px-2 py-2 text-xs font-medium text-slate-900 sm:text-sm">{cat.name}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {error && (
          <p className="border-t border-destructive/20 bg-destructive/10 px-4 py-2 text-center text-sm text-destructive sm:px-6">
            {error}
          </p>
        )}

        <DialogFooter className="flex-col gap-2 border-t border-slate-200 bg-slate-50/80 px-4 py-4 sm:flex-row sm:px-6">
          <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={saving} onClick={() => void skip()}>
            Skip for now
          </Button>
          <Button
            type="button"
            className="w-full bg-amber-500 text-black hover:bg-amber-600 sm:w-auto"
            disabled={saving || selected.size === 0}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save preferences"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
