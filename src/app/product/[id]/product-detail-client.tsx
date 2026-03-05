"use client"

import { useState, useEffect } from "react"
import { notFound, useRouter } from "next/navigation"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Button } from "@/ui/button"
import { formatCurrency } from "@/lib/utils"
import { getYoutubeEmbedUrl } from "@/lib/youtube"
import { PublicLayout } from "@/components/site-layout"
import { useCart } from "@/contexts/cart-context"
import { PageLoader } from "@/components/ui/page-loader"
import { ChevronRight, ShoppingCart, Truck } from "lucide-react"

type Variant = {
  id: string
  name: string
  price: number
  discount: number
  stock: number
  images?: unknown
  attributes?: Record<string, string> | null
}
type Product = {
  id: string
  name: string
  description: string | null
  images: unknown
  category: { id: string; name: string; slug: string }
  seller: { store: { name: string } | null }
  _count: { reviews: number }
  variants: Variant[]
}

type ProductAd = {
  id: string
  title: string
  creativeType: string
  creativeUrl: string
}

export function ProductDetailClient({ productId }: { productId: string }) {
  const router = useRouter()
  const { status } = useSession()
  const { addItem } = useCart()
  const [product, setProduct] = useState<Product | null>(null)
  const [productAd, setProductAd] = useState<ProductAd | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [addedToCart, setAddedToCart] = useState(false)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch(`/api/products/${productId}`)
      .then((r) => {
        if (r.status === 404) return null
        if (!r.ok) throw new Error("Failed to load")
        return r.json()
      })
      .then(setProduct)
      .catch(() => setProduct(null))
      .finally(() => setLoading(false))
  }, [productId])

  useEffect(() => {
    fetch(`/api/ads/product/${productId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setProductAd(data && data.id ? data : null))
      .catch(() => setProductAd(null))
  }, [productId])

  if (loading) {
    return (
      <PublicLayout>
        <PageLoader variant="detail" message="Loading product…" />
      </PublicLayout>
    )
  }
  if (!product) notFound()

  const variants = product.variants ?? []

  // Build attribute options (Amazon/Flipkart style): e.g. Size: [S, M, L], Color: [Red, Blue]
  const attributeKeys = (() => {
    const keys = new Set<string>()
    variants.forEach((v) => {
      const attrs = v.attributes && typeof v.attributes === "object" && !Array.isArray(v.attributes) ? (v.attributes as Record<string, string>) : {}
      Object.keys(attrs).forEach((k) => keys.add(k))
    })
    return Array.from(keys)
  })()
  const attributeOptions = attributeKeys.map((key) => {
    const values = new Set<string>()
    variants.forEach((v) => {
      const attrs = v.attributes && typeof v.attributes === "object" && !Array.isArray(v.attributes) ? (v.attributes as Record<string, string>) : {}
      const val = attrs[key]
      if (val != null && String(val).trim()) values.add(String(val).trim())
    })
    return { key, label: key.charAt(0).toUpperCase() + key.slice(1), values: Array.from(values) }
  })

  // Resolve selected variant: by explicit ID, or by matching selected options (attributes)
  const selectedVariant = (() => {
    if (selectedVariantId) {
      const byId = variants.find((v) => v.id === selectedVariantId)
      if (byId) return byId
    }
    if (attributeKeys.length > 0 && attributeKeys.every((k) => selectedOptions[k])) {
      return variants.find((v) => {
        const attrs = (v.attributes && typeof v.attributes === "object" && !Array.isArray(v.attributes) ? v.attributes : {}) as Record<string, string>
        return attributeKeys.every((k) => attrs[k] === selectedOptions[k])
      }) ?? null
    }
    return variants.length === 1 ? variants[0] : null
  })()

  const displayPrice = selectedVariant ? Math.max(0, selectedVariant.price - (selectedVariant.discount ?? 0)) : 0
  const variantImages = selectedVariant && Array.isArray(selectedVariant.images) ? (selectedVariant.images as string[]) : []
  const productImages = (product.images as string[]) || []
  const images = variantImages.length > 0 ? variantImages : productImages
  const mainImage = images[selectedImageIndex] || images[0]
  const adIsVideo = productAd?.creativeType === "VIDEO"
  const adEmbedUrl = adIsVideo && productAd ? getYoutubeEmbedUrl(productAd.creativeUrl) : null

  const canAddToCart = selectedVariant != null && selectedVariant.stock >= 1
  const missingAttribute = attributeKeys.length > 0 && attributeKeys.some((k) => !selectedOptions[k])
  const mustSelectVariant = variants.length > 1 && !selectedVariant
  const firstMissingKey = attributeKeys.find((k) => !selectedOptions[k])
  const firstMissingLabel = firstMissingKey ? (firstMissingKey.charAt(0).toUpperCase() + firstMissingKey.slice(1)) : ""
  const validationMessage =
    variants.length === 0
      ? "This product has no variants and cannot be added to cart."
      : mustSelectVariant
        ? missingAttribute && attributeKeys.length > 0
          ? `Please select ${firstMissingLabel} to add to cart.`
          : "Please select a variant to add to cart."
        : null

  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        {/* Breadcrumb - scroll on small screens */}
        <nav className="mb-3 sm:mb-4 flex items-center gap-1 overflow-x-auto text-xs text-slate-600 sm:text-sm pb-1 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]">
          <Link href="/" className="shrink-0 hover:text-amber-600 hover:underline">Home</Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
          <Link href="/browse" className="shrink-0 hover:text-amber-600 hover:underline">Browse</Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
          <Link href={`/browse?categoryId=${product.category.id}`} className="shrink-0 hover:text-amber-600 hover:underline">{product.category.name}</Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
          <span className="min-w-0 truncate text-slate-900 font-medium">{product.name}</span>
        </nav>

        {/* Main content: image + details */}
        <div className="rounded-xl bg-white p-4 shadow-lg sm:p-6 md:p-8">
          <div className="flex flex-col gap-6 sm:gap-8 lg:flex-row">
            {/* Left: Image gallery */}
            <div className="flex w-full shrink-0 flex-col gap-3 lg:w-[380px]">
              <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-100">
                {mainImage ? (
                  <img
                    src={mainImage}
                    alt={product.name}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-400">No image</div>
                )}
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((src, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedImageIndex(i)}
                      className={`h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 bg-slate-50 ${
                        selectedImageIndex === i ? "border-amber-500" : "border-transparent"
                      }`}
                    >
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Title, price, actions */}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500 sm:text-sm">{product.category.name}</p>
              <h1 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl md:text-3xl">{product.name}</h1>
              {product._count.reviews > 0 && (
                <p className="mt-2 text-sm text-slate-600">{product._count.reviews} rating(s)</p>
              )}

              {/* Amazon/Flipkart style: choose options (Size, Color, etc.) then Add to Cart */}
              {attributeOptions.length > 0 && (
                <div className="mt-4 space-y-4">
                  {attributeOptions.map(({ key, label, values }) => (
                    <div key={key}>
                      <p className="text-sm font-medium text-slate-700 mb-1.5">
                        {label}: {selectedOptions[key] ? <span className="font-semibold text-slate-900">{selectedOptions[key]}</span> : <span className="text-slate-500">Select {label}</span>}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {values.map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => {
                              setSelectedOptions((prev) => ({ ...prev, [key]: val }))
                              setSelectedVariantId(null)
                              setSelectedImageIndex(0)
                            }}
                            className={`min-w-[3rem] rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                              selectedOptions[key] === val
                                ? "border-amber-500 bg-amber-50 text-amber-800 ring-1 ring-amber-500"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {attributeOptions.length === 0 && variants.length > 1 && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-slate-700 mb-2">Variant</p>
                  <div className="flex flex-wrap gap-2">
                    {variants.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setSelectedVariantId(v.id)
                          setSelectedOptions({})
                          setSelectedImageIndex(0)
                        }}
                        className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                          (selectedVariantId ?? variants[0]?.id) === v.id
                            ? "border-amber-500 bg-amber-50 text-amber-800"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        {v.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-baseline gap-2">
                <span className="text-xl font-bold text-slate-900 sm:text-2xl md:text-3xl">{formatCurrency(displayPrice)}</span>
                {selectedVariant && (selectedVariant.discount ?? 0) > 0 && (
                  <span className="text-sm text-slate-500 line-through">{formatCurrency(selectedVariant.price)}</span>
                )}
              </div>
              {selectedVariant && (
                <p className="mt-1 text-sm text-slate-600">In stock: {selectedVariant.stock}</p>
              )}
              {validationMessage && (
                <p className="mt-1 text-sm font-medium text-amber-700" role="alert">
                  {validationMessage}
                </p>
              )}

              <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                <Truck className="h-4 w-4 text-green-600" />
                <span>Delivery &amp; availability shown at checkout</span>
              </div>

              <div className="mt-6 flex flex-col gap-3">
                {addedToCart && (
                  <p className="flex items-center gap-2 rounded-lg bg-green-100 px-4 py-2.5 text-sm font-medium text-green-800 ring-1 ring-green-200">
                    <span className="inline-flex h-2 w-2 rounded-full bg-green-500" aria-hidden />
                    Added to cart
                  </p>
                )}
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button
                    size="lg"
                    className="w-full bg-amber-400 text-black hover:bg-amber-500 sm:w-auto"
                    disabled={!canAddToCart}
                    onClick={() => {
                      if (!selectedVariant) return
                      addItem({
                        productId: product.id,
                        productVariantId: selectedVariant.id,
                        name: product.name + (variants.length > 1 ? ` (${selectedVariant.name})` : ""),
                        price: displayPrice,
                        image: mainImage || null,
                      })
                      setAddedToCart(true)
                      setTimeout(() => setAddedToCart(false), 3000)
                    }}
                  >
                    <ShoppingCart className="mr-2 h-5 w-5" />
                    {addedToCart ? "Added to Cart" : mustSelectVariant ? (firstMissingLabel ? `Select ${firstMissingLabel}` : "Select variant") : "Add to Cart"}
                  </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full border-amber-500 text-amber-700 hover:bg-amber-50 sm:w-auto"
                  onClick={() => {
                    if (status === "authenticated") {
                      router.push("/cart")
                    } else {
                      router.push("/customer/login?callbackUrl=" + encodeURIComponent("/cart"))
                    }
                  }}
                >
                  Buy Now
                </Button>
                </div>
              </div>

              <div className="mt-6 border-t border-slate-200 pt-4">
                <p className="text-sm text-slate-600">
                  Sold by{" "}
                  <span className="font-medium text-slate-900">{product.seller?.store?.name ?? "Store"}</span>
                </p>
                <Link
                  href={`/browse?categoryId=${product.category.id}`}
                  className="mt-1 inline-block text-sm text-blue-600 hover:underline"
                >
                  More from {product.category.name}
                </Link>
              </div>
            </div>
          </div>

          {/* Product description / details */}
          <div className="mt-8 border-t border-slate-200 pt-6 sm:mt-10 sm:pt-8">
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">About this item</h2>
            {product.description ? (
              <div className="mt-3 whitespace-pre-wrap text-slate-700">{product.description}</div>
            ) : (
              <p className="mt-3 text-slate-500">No description provided.</p>
            )}
          </div>

          {/* Sponsored banner for this product */}
          {productAd && (
            <div className="mt-8 border-t border-slate-200 pt-6 sm:mt-10 sm:pt-8">
              <h2 className="text-base font-bold text-slate-900 sm:text-lg">Sponsored for this product</h2>
              <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 sm:rounded-xl">
                <div className="relative aspect-video w-full bg-slate-100 sm:aspect-[16/5]">
                  {adIsVideo ? (
                    adEmbedUrl ? (
                      <iframe
                        src={adEmbedUrl}
                        title={productAd.title}
                        className="h-full w-full object-cover"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <video
                        src={productAd.creativeUrl}
                        className="h-full w-full object-cover"
                        controls
                        muted
                        playsInline
                        preload="metadata"
                      >
                        Your browser does not support the video tag.
                      </video>
                    )
                  ) : (
                    <img
                      src={productAd.creativeUrl}
                      alt={productAd.title}
                      className="h-full w-full object-cover"
                    />
                  )}
                  <div className="absolute bottom-2 left-2">
                    <span className="rounded bg-slate-900/80 px-2 py-0.5 text-xs font-medium text-white">
                      Sponsored
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <p className="line-clamp-2 font-semibold text-slate-900">{productAd.title}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 text-center sm:mt-6">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/browse">Continue shopping</Link>
          </Button>
        </div>
      </div>
    </PublicLayout>
  )
}

