"use client"

import { useState, useEffect } from "react"
import { notFound } from "next/navigation"
import { EditCategoryForm } from "@/components/admin/edit-category-form"

export function EditCategoryClient({ categoryId }: { categoryId: string }) {
  const [category, setCategory] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/categories/${categoryId}`)
      .then((res) => {
        if (res.status === 404) return null
        if (!res.ok) throw new Error("Failed to fetch category")
        return res.json()
      })
      .then((json) => {
        if (!cancelled) setCategory(json)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [categoryId])

  if (loading && !category) {
    return <div className="py-8 text-center text-muted-foreground">Loading...</div>
  }
  if (error || !category) {
    notFound()
  }
  return <EditCategoryForm category={category} />
}
