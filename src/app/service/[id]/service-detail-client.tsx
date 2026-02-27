"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/ui/button"
import { formatCurrency } from "@/lib/utils"
import { PublicLayout } from "@/components/site-layout"
import { useCart } from "@/contexts/cart-context"
import { ChevronRight, ShoppingCart, Truck } from "lucide-react"

type Service = {
  id: string
  name: string
  description: string | null
  basePrice: number | null
  discount: number
  images: unknown
  category: { id: string; name: string; slug: string }
  seller: { store: { name: string } | null }
  _count: { reviews: number }
}

export function ServiceDetailClient({ service }: { service: Service }) {
  const router = useRouter()
  const { status } = useSession()
  const { addItem } = useCart()
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [addedToCart, setAddedToCart] = useState(false)

  const images = (service.images as string[]) || []
  const displayPrice = service.basePrice != null ? Math.max(0, service.basePrice - service.discount) : null
  const mainImage = images[selectedImageIndex] || images[0]

  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Breadcrumb */}
        <nav className="mb-4 flex items-center gap-1 text-sm text-slate-600">
          <Link href="/" className="hover:text-amber-600 hover:underline">Home</Link>
          <ChevronRight className="h-4 w-4 shrink-0" />
          <Link href="/browse" className="hover:text-amber-600 hover:underline">Browse</Link>
          <ChevronRight className="h-4 w-4 shrink-0" />
          <Link href={`/browse?categoryId=${service.category.id}`} className="hover:text-amber-600 hover:underline">{service.category.name}</Link>
          <ChevronRight className="h-4 w-4 shrink-0" />
          <span className="truncate text-slate-900 font-medium">{service.name}</span>
        </nav>

        {/* Main content: image + details */}
        <div className="rounded-xl bg-white p-6 shadow-lg md:p-8">
          <div className="flex flex-col gap-8 lg:flex-row">
            {/* Left: Image gallery */}
            <div className="flex shrink-0 flex-col gap-3 lg:w-[380px]">
              <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-100">
                {mainImage ? (
                  <img
                    src={mainImage}
                    alt={service.name}
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
            <div className="flex-1">
              <p className="text-sm text-slate-500">{service.category.name}</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">{service.name}</h1>
              {service._count.reviews > 0 && (
                <p className="mt-2 text-sm text-slate-600">{service._count.reviews} rating(s)</p>
              )}

              <div className="mt-4 flex items-baseline gap-2">
                {displayPrice != null ? (
                  <>
                    <span className="text-2xl font-bold text-slate-900 md:text-3xl">{formatCurrency(displayPrice)}</span>
                    {service.discount > 0 && service.basePrice != null && (
                      <span className="text-sm text-slate-500 line-through">{formatCurrency(service.basePrice)}</span>
                    )}
                  </>
                ) : (
                  <span className="text-xl font-semibold text-slate-600">Price on request</span>
                )}
              </div>

              <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                <Truck className="h-4 w-4 text-green-600" />
                <span>Availability &amp; booking shown at checkout</span>
              </div>

              {displayPrice != null && (
                <div className="mt-6 flex flex-col gap-3">
                  {addedToCart && (
                    <p className="flex items-center gap-2 rounded-lg bg-green-100 px-4 py-2.5 text-sm font-medium text-green-800 ring-1 ring-green-200">
                      <span className="inline-flex h-2 w-2 rounded-full bg-green-500" aria-hidden />
                      Added to cart
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <Button
                      size="lg"
                      className="bg-amber-400 text-black hover:bg-amber-500"
                      onClick={() => {
                        addItem({
                          serviceId: service.id,
                          name: service.name,
                          price: displayPrice,
                          image: mainImage || null,
                        })
                        setAddedToCart(true)
                        setTimeout(() => setAddedToCart(false), 3000)
                      }}
                    >
                      <ShoppingCart className="mr-2 h-5 w-5" />
                      {addedToCart ? "Added to Cart" : "Add to Cart"}
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="border-amber-500 text-amber-700 hover:bg-amber-50"
                      onClick={() => {
                        if (status === "authenticated") {
                          router.push("/cart")
                        } else {
                          router.push("/login?callbackUrl=" + encodeURIComponent("/cart"))
                        }
                      }}
                    >
                      Book / Buy Now
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-6 border-t border-slate-200 pt-4">
                <p className="text-sm text-slate-600">
                  Sold by{" "}
                  <span className="font-medium text-slate-900">{service.seller?.store?.name ?? "Store"}</span>
                </p>
                <Link
                  href={`/browse?categoryId=${service.category.id}`}
                  className="mt-1 inline-block text-sm text-blue-600 hover:underline"
                >
                  More from {service.category.name}
                </Link>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mt-10 border-t border-slate-200 pt-8">
            <h2 className="text-lg font-bold text-slate-900">About this service</h2>
            {service.description ? (
              <div className="mt-3 whitespace-pre-wrap text-slate-700">{service.description}</div>
            ) : (
              <p className="mt-3 text-slate-500">No description provided.</p>
            )}
          </div>
        </div>

        <div className="mt-6 text-center">
          <Button asChild variant="outline">
            <Link href="/browse">Continue shopping</Link>
          </Button>
        </div>
      </div>
    </PublicLayout>
  )
}
