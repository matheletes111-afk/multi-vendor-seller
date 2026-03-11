"use client"

import { useState, useEffect } from "react"
import { BannerForm } from "@/components/admin/banner-form"
import { PageLoader } from "@/components/ui/page-loader"

export function NewBannerClient() {
  const [categories, setCategories] = useState<any[]>([])
  const [serviceCategories, setServiceCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch("/api/admin/categories/list").then((res) => (res.ok ? res.json() : [])),
      fetch("/api/admin/service-categories/list").then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([categoriesData, serviceCategoriesData]) => {
        if (!cancelled) {
          setCategories(categoriesData)
          setServiceCategories(serviceCategoriesData)
        }
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
  }, [])

  if (loading) {
    return <PageLoader message="Loading…" />
  }
  if (error) {
    return <div className="py-8 text-center text-destructive">{error}</div>
  }
  return <BannerForm categories={categories} serviceCategories={serviceCategories} />
}
