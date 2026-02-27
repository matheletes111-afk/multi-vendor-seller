"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ChevronDown, LayoutGrid } from "lucide-react"

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
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/home/categories")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [])

  if (categories.length === 0) return null

  return (
    <div className="border-b border-blue-900/20 bg-blue-900/40 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-1 overflow-x-auto py-2 scroll-smooth [scrollbar-width:thin]">
          <Link
            href="/browse"
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-white/15 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/25"
          >
            <LayoutGrid className="h-4 w-4" />
            All
          </Link>
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="relative shrink-0"
              onMouseEnter={() => setOpenId(cat.id)}
              onMouseLeave={() => setOpenId(null)}
            >
              <Link
                href={`/browse?categoryId=${cat.id}`}
                className="flex items-center gap-0.5 rounded-md px-3 py-1.5 text-sm font-medium text-blue-100 hover:bg-white/15 hover:text-white"
              >
                {cat.name}
                {cat.subcategories.length > 0 && (
                  <ChevronDown className="h-4 w-4 ml-0.5" />
                )}
              </Link>
              {cat.subcategories.length > 0 && openId === cat.id && (
                <div className="absolute left-0 top-full z-50 mt-0.5 min-w-[180px] rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                  {cat.subcategories.map((sub) => (
                    <Link
                      key={sub.id}
                      href={`/browse?subcategoryId=${sub.id}`}
                      className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      {sub.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
