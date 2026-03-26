"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { UserRole } from "@prisma/client"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { formatCurrency } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { Package, Briefcase, ChevronRight, ChevronDown, Filter, X, ArrowUp } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/ui/sheet"
import { BrowseProductCard, type BrowseProduct } from "./browse-product-card"
import { getServiceFirstDisplayImageUrl } from "@/lib/service-images"

type Service = {
  id: string
  name: string
  basePrice: number | null
  images?: unknown
  galleryImages?: unknown
  serviceCategory: { name: string }
  seller: { store: { name: string } | null } | null
  _count: { reviews: number }
}

type Subcategory = { id: string; name: string; slug: string }

type FilterMeta = {
  categories: { id: string; name: string; slug: string }[]
  brands: string[]
  priceExtent: { min: number; max: number }
}

const INITIAL_LIST = 5
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "newest", label: "Newest Arrivals" },
  { value: "bestseller", label: "Best Selling" },
  { value: "rating", label: "Avg. Customer Review" },
]

const DISC_OPTS = [10, 20, 30, 40, 50] as const
const RET_OPTS: { code: string; label: string }[] = [
  { code: "fr", label: "Free Returns (7+ days)" },
  { code: "7", label: "7 Days Return" },
  { code: "10", label: "10 Days Return" },
  { code: "30", label: "30 Days Return" },
  { code: "none", label: "Non-returnable" },
]

function CollapsibleSection({
  title,
  tooltip,
  defaultOpen = true,
  children,
}: {
  title: string
  tooltip?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-slate-200 py-4 last:border-b-0">
      <button
        type="button"
        title={tooltip}
        className="flex w-full cursor-pointer items-center justify-between gap-2 text-left font-semibold text-slate-900 transition-colors hover:text-amber-700"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform duration-200", open ? "rotate-180" : "")} />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pt-3">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function BrowseClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { status, data: session } = useSession()
  const canUseWishlist = status === "authenticated" && session?.user?.role === UserRole.CUSTOMER

  const categoryId = searchParams.get("categoryId")
  const catsParam = searchParams.get("cats")
  const subcategoryId = searchParams.get("subcategoryId")
  const q = searchParams.get("q")
  const sortParam = searchParams.get("sort")
  const sort =
    sortParam === "price_desc" ||
    sortParam === "price_asc" ||
    sortParam === "newest" ||
    sortParam === "featured" ||
    sortParam === "bestseller" ||
    sortParam === "rating"
      ? sortParam
      : "newest"

  const minPrice = Number(searchParams.get("minPrice") ?? "0")
  const maxPrice = Number(searchParams.get("maxPrice") ?? "100000")
  const brandsParam = searchParams.get("brands")
  const ratingParam = searchParams.get("rating")
  const discParam = searchParams.get("disc")
  const retParam = searchParams.get("ret")
  const availParam = searchParams.get("avail")
  const sellerParam = searchParams.get("seller")

  const pageParam = Number(searchParams.get("page") ?? "1")
  const currentPage = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1

  const [products, setProducts] = useState<BrowseProduct[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [totalProducts, setTotalProducts] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [categoryName, setCategoryName] = useState<string | null>(null)
  const [subcategoryName, setSubcategoryName] = useState<string | null>(null)
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [resolvedCategoryId, setResolvedCategoryId] = useState<string | null>(null)
  const [filterMeta, setFilterMeta] = useState<FilterMeta | null>(null)
  const [pageSize, setPageSize] = useState(12)
  const [loading, setLoading] = useState(true)

  const [catSearch, setCatSearch] = useState("")
  const [brandSearch, setBrandSearch] = useState("")
  const [showAllCats, setShowAllCats] = useState(false)
  const [showAllBrands, setShowAllBrands] = useState(false)
  const [priceMinDraft, setPriceMinDraft] = useState("")
  const [priceMaxDraft, setPriceMaxDraft] = useState("")
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [scrollTopVisible, setScrollTopVisible] = useState(false)

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams()
    if (categoryId) params.set("categoryId", categoryId)
    if (catsParam) params.set("cats", catsParam)
    if (subcategoryId) params.set("subcategoryId", subcategoryId)
    if (q) params.set("q", q)
    if (sort && sort !== "newest") params.set("sort", sort)
    if (Number.isFinite(minPrice) && minPrice > 0) params.set("minPrice", String(minPrice))
    if (Number.isFinite(maxPrice) && maxPrice < 100000) params.set("maxPrice", String(maxPrice))
    if (brandsParam) params.set("brands", brandsParam)
    if (ratingParam) params.set("rating", ratingParam)
    if (discParam) params.set("disc", discParam)
    if (retParam) params.set("ret", retParam)
    if (availParam) params.set("avail", availParam)
    if (sellerParam) params.set("seller", sellerParam)
    params.set("page", String(currentPage))
    return params.toString()
  }, [
    categoryId,
    catsParam,
    subcategoryId,
    q,
    sort,
    minPrice,
    maxPrice,
    brandsParam,
    ratingParam,
    discParam,
    retParam,
    availParam,
    sellerParam,
    currentPage,
  ])

  useEffect(() => {
    const qs = buildQuery()
    setLoading(true)
    fetch(`/api/customer/browse${qs ? `?${qs}` : ""}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then(
        (data: {
          products?: BrowseProduct[]
          services?: Service[]
          totalProducts?: number
          totalPages?: number
          pageSize?: number
          categoryName?: string | null
          subcategoryName?: string | null
          subcategories?: Subcategory[]
          resolvedCategoryId?: string | null
          filterMeta?: FilterMeta
        }) => {
          setProducts(data.products || [])
          setServices(data.services || [])
          setTotalProducts(data.totalProducts ?? 0)
          setTotalPages(Math.max(1, data.totalPages ?? 1))
          setPageSize(typeof data.pageSize === "number" && data.pageSize > 0 ? data.pageSize : 12)
          setCategoryName(data.categoryName ?? null)
          setSubcategoryName(data.subcategoryName ?? null)
          setSubcategories(data.subcategories || [])
          setResolvedCategoryId(data.resolvedCategoryId ?? null)
          setFilterMeta(data.filterMeta ?? null)
        }
      )
      .finally(() => setLoading(false))
  }, [buildQuery])

  const searchKey = searchParams.toString()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [searchKey])

  useEffect(() => {
    const onScroll = () => setScrollTopVisible(window.scrollY > 400)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    setPriceMinDraft(Number.isFinite(minPrice) && minPrice > 0 ? String(Math.round(minPrice)) : "")
    setPriceMaxDraft(
      Number.isFinite(maxPrice) && maxPrice < 100000 ? String(Math.round(maxPrice)) : ""
    )
  }, [minPrice, maxPrice])

  const updateFilters = (updates: Record<string, string | null>, resetPage = true) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value == null || value === "") params.delete(key)
      else params.set(key, value)
    })
    if (resetPage) params.delete("page")
    router.push(`/browse${params.toString() ? `?${params.toString()}` : ""}`)
  }

  const clearAllFilters = () => {
    const next = new URLSearchParams()
    if (q) next.set("q", q)
    router.push(`/browse${next.toString() ? `?${next.toString()}` : ""}`)
  }

  const changePage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (nextPage <= 1) params.delete("page")
    else params.set("page", String(nextPage))
    router.push(`/browse${params.toString() ? `?${params.toString()}` : ""}`)
  }

  const selectedCats = useMemo(() => new Set(parseComma(catsParam)), [catsParam])
  const selectedBrands = useMemo(() => new Set(parseComma(brandsParam)), [brandsParam])
  const selectedDisc = useMemo(() => new Set(parseComma(discParam)), [discParam])
  const selectedRet = useMemo(() => new Set(parseComma(retParam)), [retParam])

  function parseComma(s: string | null): string[] {
    if (!s?.trim()) return []
    return s.split(",").map((x) => x.trim()).filter(Boolean)
  }

  function toggleCat(id: string) {
    const next = new Set(selectedCats)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    const cats = [...next].join(",")
    updateFilters({ cats: cats || null, categoryId: null })
  }

  function toggleBrand(brand: string) {
    const next = new Set(selectedBrands)
    if (next.has(brand)) next.delete(brand)
    else next.add(brand)
    updateFilters({ brands: [...next].join(",") || null })
  }

  function toggleDisc(n: number) {
    const next = new Set(selectedDisc)
    const key = String(n)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    updateFilters({ disc: [...next].join(",") || null })
  }

  function toggleRet(code: string) {
    const next = new Set(selectedRet)
    if (next.has(code)) next.delete(code)
    else next.add(code)
    updateFilters({ ret: [...next].join(",") || null })
  }

  const activeChips: { key: string; label: string; clear: () => void }[] = []
  if (catsParam) activeChips.push({ key: "cats", label: `Categories (${parseComma(catsParam).length})`, clear: () => updateFilters({ cats: null }) })
  if (categoryId && !catsParam) activeChips.push({ key: "cat", label: "Category", clear: () => updateFilters({ categoryId: null }) })
  if (subcategoryId) activeChips.push({ key: "sub", label: "Subcategory", clear: () => updateFilters({ subcategoryId: null }) })
  if (brandsParam) activeChips.push({ key: "brands", label: `Brands (${parseComma(brandsParam).length})`, clear: () => updateFilters({ brands: null }) })
  if (ratingParam) activeChips.push({ key: "rating", label: `${ratingParam}+ stars`, clear: () => updateFilters({ rating: null }) })
  if (discParam) activeChips.push({ key: "disc", label: "Discount", clear: () => updateFilters({ disc: null }) })
  if (retParam) activeChips.push({ key: "ret", label: "Return policy", clear: () => updateFilters({ ret: null }) })
  if (availParam) activeChips.push({ key: "avail", label: availParam === "in" ? "In stock" : "Out of stock", clear: () => updateFilters({ avail: null }) })
  if (sellerParam) activeChips.push({ key: "seller", label: sellerParam === "branded" ? "Branded store" : "Regular seller", clear: () => updateFilters({ seller: null }) })
  if (Number.isFinite(minPrice) && minPrice > 0) activeChips.push({ key: "min", label: `Min ${formatCurrency(minPrice)}`, clear: () => updateFilters({ minPrice: null }) })
  if (Number.isFinite(maxPrice) && maxPrice < 100000) activeChips.push({ key: "max", label: `Max ${formatCurrency(maxPrice)}`, clear: () => updateFilters({ maxPrice: null }) })

  const pageTitle = subcategoryName ?? categoryName ?? "Browse Marketplace"
  const isSubcategoryView = !!subcategoryId
  const isProductCategoryFilter = !!(categoryId || subcategoryId || catsParam)
  const showSubcategoryPills = subcategories.length > 0 && !subcategoryId

  const categories = filterMeta?.categories ?? []
  const brands = filterMeta?.brands ?? []
  const priceExtent = filterMeta?.priceExtent ?? { min: 0, max: 0 }

  const filteredCats = categories.filter((c) => c.name.toLowerCase().includes(catSearch.toLowerCase()))
  const visibleCats = showAllCats ? filteredCats : filteredCats.slice(0, INITIAL_LIST)
  const filteredBrands = brands.filter((b) => b.toLowerCase().includes(brandSearch.toLowerCase()))
  const visibleBrands = showAllBrands ? filteredBrands : filteredBrands.slice(0, INITIAL_LIST)

  const safeMin = Number.isFinite(minPrice) ? Math.max(0, minPrice) : 0
  const safeMax = Number.isFinite(maxPrice) ? Math.max(0, maxPrice) : 100000
  const startIdx = totalProducts === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endIdx = totalProducts === 0 ? 0 : Math.min(currentPage * pageSize, totalProducts)

  const filterSidebar = (
    <div className="space-y-0">
      <CollapsibleSection title="Department" tooltip="Filter by product category">
        <Input
          placeholder="Search categories"
          value={catSearch}
          onChange={(e) => setCatSearch(e.target.value)}
          className="mb-2 h-9 text-sm"
        />
        <label className="flex cursor-pointer items-center gap-2 py-1 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={selectedCats.size === 0 && !categoryId}
            onChange={() => updateFilters({ cats: null, categoryId: null })}
            className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
          />
          All
        </label>
        {visibleCats.map((c) => (
          <label key={c.id} className="flex cursor-pointer items-center gap-2 py-1 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={selectedCats.has(c.id) || (categoryId === c.id && !catsParam)}
              onChange={() => {
                if (categoryId && !catsParam) updateFilters({ categoryId: null })
                toggleCat(c.id)
              }}
              className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
            />
            {c.name}
          </label>
        ))}
        {filteredCats.length > INITIAL_LIST && (
          <button type="button" className="mt-1 text-sm font-medium text-blue-600 hover:underline" onClick={() => setShowAllCats((v) => !v)}>
            {showAllCats ? "See less" : "See more"}
          </button>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Brands" tooltip="Filter by brand (from product attributes)">
        <Input
          placeholder="Search brands"
          value={brandSearch}
          onChange={(e) => setBrandSearch(e.target.value)}
          className="mb-2 h-9 text-sm"
        />
        {visibleBrands.map((b) => (
          <label key={b} className="flex cursor-pointer items-center gap-2 py-1 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={selectedBrands.has(b)}
              onChange={() => toggleBrand(b)}
              className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
            />
            {b}
          </label>
        ))}
        {filteredBrands.length > INITIAL_LIST && (
          <button type="button" className="mt-1 text-sm font-medium text-blue-600 hover:underline" onClick={() => setShowAllBrands((v) => !v)}>
            {showAllBrands ? "See less" : "See more"}
          </button>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Customer reviews">
        <div className="space-y-2">
          {[
            { v: "4", label: "4 stars & up" },
            { v: "3", label: "3 stars & up" },
            { v: "2", label: "2 stars & up" },
            { v: "1", label: "1 star & up" },
          ].map(({ v, label }) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="rating-filter"
                checked={ratingParam === v}
                onChange={() => updateFilters({ rating: v })}
                className="border-slate-300 text-amber-500 focus:ring-amber-500"
              />
              <span className="text-amber-500">★</span>
              <span className="text-slate-700">{label}</span>
            </label>
          ))}
          {ratingParam && (
            <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => updateFilters({ rating: null })}>
              Clear rating
            </button>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Price">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-xs text-slate-500">Min</label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
              <Input
                className="pl-7"
                inputMode="numeric"
                value={priceMinDraft}
                onChange={(e) => setPriceMinDraft(e.target.value.replace(/[^\d]/g, ""))}
                placeholder={String(Math.round(priceExtent.min))}
              />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-xs text-slate-500">Max</label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
              <Input
                className="pl-7"
                inputMode="numeric"
                value={priceMaxDraft}
                onChange={(e) => setPriceMaxDraft(e.target.value.replace(/[^\d]/g, ""))}
                placeholder={String(Math.round(priceExtent.max))}
              />
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            className="bg-amber-400 text-black hover:bg-amber-500"
            onClick={() => {
              const minV = priceMinDraft ? Number(priceMinDraft) : null
              const maxV = priceMaxDraft ? Number(priceMaxDraft) : null
              updateFilters({
                minPrice: minV != null && minV > 0 ? String(minV) : null,
                maxPrice: maxV != null && maxV > 0 && maxV < 100000 ? String(maxV) : null,
              })
            }}
          >
            Apply
          </Button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Range in results: {formatCurrency(priceExtent.min)} – {formatCurrency(priceExtent.max)}
        </p>
      </CollapsibleSection>

      <CollapsibleSection title="Discount">
        <div className="space-y-2">
          {DISC_OPTS.map((n) => (
            <label key={n} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={selectedDisc.has(String(n))}
                onChange={() => toggleDisc(n)}
                className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
              />
              {n}% and above
            </label>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Return / Refund">
        <div className="space-y-2">
          {RET_OPTS.map(({ code, label }) => (
            <label key={code} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={selectedRet.has(code)}
                onChange={() => toggleRet(code)}
                className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
              />
              {label}
            </label>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Availability">
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="avail"
              checked={!availParam}
              onChange={() => updateFilters({ avail: null })}
              className="border-slate-300 text-amber-500 focus:ring-amber-500"
            />
            Any
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="avail"
              checked={availParam === "in"}
              onChange={() => updateFilters({ avail: "in" })}
              className="border-slate-300 text-amber-500 focus:ring-amber-500"
            />
            In Stock
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="avail"
              checked={availParam === "out"}
              onChange={() => updateFilters({ avail: "out" })}
              className="border-slate-300 text-amber-500 focus:ring-amber-500"
            />
            Out of Stock
          </label>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Seller type">
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="seller"
              checked={!sellerParam}
              onChange={() => updateFilters({ seller: null })}
              className="border-slate-300 text-amber-500 focus:ring-amber-500"
            />
            Any
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="seller"
              checked={sellerParam === "branded"}
              onChange={() => updateFilters({ seller: "branded" })}
              className="border-slate-300 text-amber-500 focus:ring-amber-500"
            />
            Branded Store
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="seller"
              checked={sellerParam === "regular"}
              onChange={() => updateFilters({ seller: "regular" })}
              className="border-slate-300 text-amber-500 focus:ring-amber-500"
            />
            Regular Seller
          </label>
        </div>
      </CollapsibleSection>
    </div>
  )

  return (
    <div className="min-w-0 overflow-x-hidden bg-slate-50/80">
      <div className="mx-auto max-w-[1400px] px-4 md:px-6">
        <div className="py-5 md:py-8">
          {(categoryName || subcategoryName) && (
            <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
              <Link href="/browse" className="hover:text-foreground hover:underline">
                Browse
              </Link>
              {categoryName && (
                <>
                  <ChevronRight className="h-4 w-4 shrink-0" />
                  {isSubcategoryView && resolvedCategoryId ? (
                    <Link href={`/browse?categoryId=${resolvedCategoryId}`} className="hover:text-foreground hover:underline">
                      {categoryName}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground">{categoryName}</span>
                  )}
                </>
              )}
              {subcategoryName && (
                <>
                  <ChevronRight className="h-4 w-4 shrink-0" />
                  <span className="font-medium text-foreground">{subcategoryName}</span>
                </>
              )}
            </nav>
          )}

          <div className="mb-6">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl md:text-3xl">{pageTitle}</h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              {isSubcategoryView
                ? `Products in ${subcategoryName}`
                : categoryName
                  ? `Products in ${categoryName}`
                  : "Discover products and services from our sellers"}
            </p>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <aside className="sticky top-4 hidden w-72 shrink-0 self-start rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:block">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Filters</h2>
              {filterSidebar}
            </aside>

            <main className="min-w-0 flex-1 space-y-4">
              <div className="flex items-center gap-2 lg:hidden">
                <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                  <SheetTrigger asChild>
                    <Button type="button" variant="outline" className="border-slate-300">
                      <Filter className="mr-2 h-4 w-4" />
                      Filters
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[min(100vw,20rem)] overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>Filters</SheetTitle>
                    </SheetHeader>
                    <div className="mt-4">{filterSidebar}</div>
                  </SheetContent>
                </Sheet>
              </div>

              {showSubcategoryPills && (
                <section>
                  <h2 className="sr-only">Subcategories</h2>
                  <div className="flex flex-wrap gap-2">
                    {subcategories.map((sub) => (
                      <Link
                        key={sub.id}
                        href={`/browse?subcategoryId=${sub.id}`}
                        className="inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-amber-400 hover:bg-amber-50 hover:text-amber-900"
                      >
                        {sub.name}
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    <span>
                      {totalProducts === 0
                        ? "No results"
                        : `Showing ${startIdx}–${endIdx} of ${totalProducts} results`}
                    </span>
                    {activeChips.length > 0 && (
                      <Button type="button" variant="ghost" size="sm" className="h-8 text-amber-700" onClick={clearAllFilters}>
                        Clear all filters
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor="sortBy" className="text-xs font-semibold uppercase text-slate-500">
                      Sort by
                    </label>
                    <select
                      id="sortBy"
                      value={sort}
                      onChange={(e) => updateFilters({ sort: e.target.value === "newest" ? null : e.target.value })}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      {SORT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {activeChips.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    {activeChips.map((c) => (
                      <span
                        key={c.key}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-800"
                      >
                        {c.label}
                        <button
                          type="button"
                          className="rounded p-0.5 hover:bg-slate-200"
                          aria-label={`Remove ${c.label}`}
                          onClick={c.clear}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <Package className="h-5 w-5 shrink-0 text-slate-600" />
                  <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Products</h2>
                  <Badge variant="secondary" className="text-xs">
                    {totalProducts}
                  </Badge>
                </div>

                {loading ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="animate-pulse overflow-hidden rounded-lg border border-slate-200 bg-white">
                        <div className="aspect-square bg-slate-200" />
                        <div className="space-y-2 p-3">
                          <div className="h-4 w-3/4 rounded bg-slate-200" />
                          <div className="h-4 w-1/2 rounded bg-slate-200" />
                          <div className="h-8 w-full rounded bg-slate-200" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : products.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-white py-16 text-center">
                    <p className="text-slate-600">No products found</p>
                    <Button type="button" variant="outline" className="mt-4" onClick={clearAllFilters}>
                      Clear filters
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {products.map((product) => (
                      <BrowseProductCard
                        key={product.id}
                        product={product}
                        canUseWishlist={canUseWishlist}
                        showFreeDelivery={product.finalPrice >= 35}
                      />
                    ))}
                  </div>
                )}

                {!loading && totalProducts > 0 && (
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => changePage(currentPage - 1)}
                        disabled={currentPage <= 1}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => changePage(currentPage + 1)}
                        disabled={currentPage >= totalPages}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {!isProductCategoryFilter && (
                <section>
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <Briefcase className="h-5 w-5 shrink-0 text-slate-600" />
                    <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Services</h2>
                    <Badge variant="secondary" className="text-xs">
                      {services.length}
                    </Badge>
                  </div>
                  {services.length === 0 ? (
                    <div className="rounded-lg border border-slate-200 bg-white py-12 text-center text-muted-foreground">No services available</div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {services.map((service) => {
                        const firstImg = getServiceFirstDisplayImageUrl(service)
                        return (
                          <Link key={service.id} href={`/service/${service.id}`} className="block min-w-0">
                            <div className="h-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-lg">
                              <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
                                {firstImg ? (
                                  <img src={firstImg} alt={service.name} className="h-full w-full object-cover" loading="lazy" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-slate-400">
                                    <Briefcase className="h-10 w-10" />
                                  </div>
                                )}
                              </div>
                              <div className="p-4">
                                <p className="line-clamp-2 font-medium text-slate-900">{service.name}</p>
                                <Badge variant="outline" className="mt-1 text-xs">
                                  {service.serviceCategory?.name ?? "Service"}
                                </Badge>
                                {service.basePrice ? (
                                  <p className="mt-2 text-lg font-bold">{formatCurrency(service.basePrice)}</p>
                                ) : (
                                  <p className="mt-2 text-sm text-muted-foreground">Price on request</p>
                                )}
                                <p className="text-sm text-muted-foreground">{service.seller?.store?.name || "Store"}</p>
                              </div>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </section>
              )}
            </main>
          </div>
        </div>
      </div>

      {scrollTopVisible && (
        <button
          type="button"
          className="fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white shadow-lg transition hover:bg-amber-50"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
        >
          <ArrowUp className="h-5 w-5 text-amber-600" />
        </button>
      )}
    </div>
  )
}
