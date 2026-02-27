"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { LayoutGrid } from "lucide-react"

type Subcategory = {
  id: string
  name: string
  slug: string
  image: string | null
}

type Category = {
  id: string
  name: string
  slug: string
  subcategories: Subcategory[]
}

export function CategoriesNav() {
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    fetch("/api/home/categories")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [])

  if (categories.length === 0) return null

  const allSubcategories = categories.flatMap((cat) => cat.subcategories)

  return (
    <div className="border-b border-blue-900/20 bg-blue-900/40 shadow-sm">
      <div className="container mx-auto px-4">
        {/* First row: main categories only */}
        <div className="flex items-center gap-1 overflow-x-auto py-2.5 scroll-smooth [scrollbar-width:thin]">
          <Link
            href="/browse"
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-white/15 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/25"
          >
            <LayoutGrid className="h-4 w-4" />
            All
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/browse?categoryId=${cat.id}`}
              className="flex shrink-0 items-center rounded-md px-3 py-1.5 text-sm font-medium text-blue-100 hover:bg-white/15 hover:text-white"
            >
              {cat.name}
            </Link>
          ))}
        </div>
        {/* Horizontal line */}
        <hr className="border-t border-blue-700/50 my-0" />
        {/* Second row: subcategories only */}
        <div className="flex items-center gap-1 overflow-x-auto py-2 scroll-smooth [scrollbar-width:thin]">
          {allSubcategories.map((sub) => (
            <Link
              key={sub.id}
              href={`/browse?subcategoryId=${sub.id}`}
              className="flex shrink-0 items-center rounded-md px-3 py-1.5 text-xs font-medium text-blue-100/90 hover:bg-white/15 hover:text-white"
            >
              {sub.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
