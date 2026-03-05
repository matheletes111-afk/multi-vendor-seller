"use client"

import { useState, useEffect } from "react"
import { notFound } from "next/navigation"
import { BannerForm } from "@/components/admin/banner-form"
import { PageLoader } from "@/components/ui/page-loader"

export function EditBannerClient({ bannerId }: { bannerId: string }) {
  const [banner, setBanner] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch(`/api/admin/banners/${bannerId}`).then((res) => {
        if (!res.ok) throw new Error("Failed to fetch banner")
        return res.json()
      }),
      fetch("/api/admin/categories/list").then((res) => {
        if (!res.ok) throw new Error("Failed to fetch categories")
        return res.json()
      }),
    ])
      .then(([bannerData, categoriesData]) => {
        if (!cancelled) {
          setBanner(bannerData)
          setCategories(categoriesData)
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
  }, [bannerId])

  if (loading && !banner) {
    return <PageLoader message="Loading banner…" />
  }
  if (error || !banner) {
    notFound()
  }
  return <BannerForm banner={banner} categories={categories} />
}
