"use client"

import { useState, useCallback, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/ui/button"
import { formatCurrency } from "@/lib/utils"
import { PublicLayout } from "@/components/site-layout"
import { PublicReviewsSection, type PublicReviewItem } from "@/components/reviews/public-reviews-section"
import { UserRole } from "@prisma/client"
import { Briefcase, Calendar, ChevronRight, Clock, Loader2, Truck } from "lucide-react"

type Service = {
  id: string
  name: string
  description: string | null
  basePrice: number | null
  discount: number
  images: unknown
  serviceType: string
  duration: number | null
  serviceCategory: { id: string; name: string; slug: string }
  seller: { store: { name: string } | null } | null
  _count: { reviews: number }
  averageRating: number
  reviews: PublicReviewItem[]
}

type SlotApi = { startTime: string; endTime: string }

function formatSlotTime(iso: string): string {
  const d = new Date(iso)
  const hh = String(d.getUTCHours()).padStart(2, "0")
  const mm = String(d.getUTCMinutes()).padStart(2, "0")
  return `${hh}:${mm} UTC`
}

function toDateKey(d: Date): string {
  // Use local calendar date, not UTC ISO date, to avoid day-shift bugs in positive timezones.
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

const SLOT_DATE_LABEL_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
})

function formatSlotDateLabel(dateKey: string): string {
  // Build date in UTC to keep labels stable across server/client time zones.
  const d = new Date(`${dateKey}T00:00:00.000Z`)
  return SLOT_DATE_LABEL_FORMATTER.format(d)
}

const SLOTS_VISIBLE_INITIAL = 6

export function ServiceDetailClient({ service }: { service: Service }) {
  const router = useRouter()
  const { data: session, status } = useSession()
  const isCustomer = session?.user?.role === UserRole.CUSTOMER
  const canBook = status !== "authenticated" || isCustomer
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [slots, setSlots] = useState<SlotApi[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<SlotApi | null>(null)
  const [bookError, setBookError] = useState<string | null>(null)
  const [slotsExpanded, setSlotsExpanded] = useState(false)

  // Collapse slots when user picks a different date
  useEffect(() => {
    setSlotsExpanded(false)
  }, [selectedDate])

  const fetchSlots = useCallback(
    async (date: string) => {
      setLoadingSlots(true)
      setSelectedSlot(null)
      setBookError(null)
      try {
        const res = await fetch(
          `/api/customer/services/${service.id}/slots?from=${date}&to=${date}`,
          { credentials: "include" }
        )
        const data = (await res.json()) as SlotApi[]
        setSlots(Array.isArray(data) ? data : [])
      } catch {
        setSlots([])
      } finally {
        setLoadingSlots(false)
      }
    },
    [service.id]
  )

  const onSelectDate = useCallback(
    (dateKey: string) => {
      setSelectedDate(dateKey)
      fetchSlots(dateKey)
    },
    [fetchSlots]
  )

  const images: string[] = Array.isArray(service.images)
    ? (service.images as string[])
    : typeof service.images === "string"
      ? (() => {
          try {
            return JSON.parse(service.images) as string[]
          } catch {
            return []
          }
        })()
      : []
  const displayPrice = service?.basePrice != null ? Math.max(0, service.basePrice - service.discount) : null
  const mainImage = images[selectedImageIndex] || images[0]

  const canBookWithoutSlot = false
  const canProceedToBook: boolean = selectedSlot != null && selectedDate != null

  const goToBook = useCallback(() => {
    const q = new URLSearchParams()
    q.set("serviceId", service.id)
    if (!canBookWithoutSlot && selectedSlot) {
      q.set("slotStartTime", selectedSlot.startTime)
      q.set("slotEndTime", selectedSlot.endTime)
    }
    const path = "/service-book?" + q.toString()
    if (!session?.user?.id || !isCustomer) {
      router.push("/customer/login?callbackUrl=" + encodeURIComponent(path))
    } else {
      router.push(path)
    }
  }, [service.id, canBookWithoutSlot, selectedSlot, session?.user?.id, isCustomer, router])

  const next14Days: string[] = []
  const today = new Date()
  for (let i = 0; i < 14; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    next14Days.push(toDateKey(d))
  }

  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Breadcrumb */}
        <nav className="mb-4 flex items-center gap-1 text-sm text-slate-600">
          <Link href="/" className="hover:text-amber-600 hover:underline">Home</Link>
          <ChevronRight className="h-4 w-4 shrink-0" />
          <Link href="/browse" className="hover:text-amber-600 hover:underline">Browse</Link>
          <ChevronRight className="h-4 w-4 shrink-0" />
          <Link href={`/browse?serviceCategoryId=${service.serviceCategory.id}`} className="hover:text-amber-600 hover:underline">{service.serviceCategory.name}</Link>
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
                  <div className="flex h-full w-full items-center justify-center text-slate-400">
                    <Briefcase className="h-16 w-16 sm:h-20 sm:w-20" />
                  </div>
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

            {/* Right: Title, price, slot selection, actions */}
            <div className="flex-1">
              <p className="text-sm text-slate-500">{service.serviceCategory.name}</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">{service.name}</h1>
              {service._count.reviews > 0 && (
                <p className="mt-2 text-sm text-slate-600">
                  {service.averageRating.toFixed(1)} rating from {service._count.reviews} review
                  {service._count.reviews === 1 ? "" : "s"}
                </p>
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

              {service?.duration ? (
                <p className="mt-2 text-sm text-slate-600">
                  <Clock className="mr-1.5 inline h-4 w-4" />
                  Duration: {service.duration} min
                </p>
              ) : null}

              <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                <Truck className="h-4 w-4 text-green-600" />
                <span>
                  Choose a date and time slot to book.
                </span>
              </div>

              {/* Slot selection for all service types */}
              {
                <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Calendar className="h-4 w-4" />
                    Select date and time
                  </h3>
                  <div className="mt-3">
                    <p className="mb-2 text-xs font-medium text-slate-500">Date</p>
                    <div className="flex flex-wrap gap-2">
                      {next14Days.map((dateKey) => {
                        const label = formatSlotDateLabel(dateKey)
                        return (
                          <button
                            key={dateKey}
                            type="button"
                            onClick={() => onSelectDate(dateKey)}
                            className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                              selectedDate === dateKey
                                ? "border-amber-500 bg-amber-50 text-amber-800"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                            }`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {selectedDate && (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-medium text-slate-500">Time</p>
                      {loadingSlots ? (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading slots…
                        </div>
                      ) : slots.length === 0 ? (
                        <p className="text-sm text-slate-500">No slots available on this day.</p>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-2">
                            {(slotsExpanded ? slots : slots.slice(0, SLOTS_VISIBLE_INITIAL)).map((slot) => {
                              const isSelected = selectedSlot?.startTime === slot.startTime
                              return (
                                <button
                                  key={slot.startTime}
                                  type="button"
                                  onClick={() => setSelectedSlot(slot)}
                                  className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                                    isSelected
                                      ? "border-amber-500 bg-amber-50 text-amber-800"
                                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                                  }`}
                                >
                                  {formatSlotTime(slot.startTime)} – {formatSlotTime(slot.endTime)}
                                </button>
                              )
                            })}
                          </div>
                          {slots.length > SLOTS_VISIBLE_INITIAL && (
                            <button
                              type="button"
                              onClick={() => setSlotsExpanded((v) => !v)}
                              className="mt-2 text-sm font-medium text-amber-600 hover:text-amber-700 hover:underline"
                            >
                              {slotsExpanded ? "See less" : `See more (${slots.length - SLOTS_VISIBLE_INITIAL} more)`}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              }

              {displayPrice != null && (
                <div className="mt-6 flex flex-col gap-3">
                  {!canBook && (
                    <p className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm text-slate-700 ring-1 ring-slate-200">
                      Sign in as a customer to book this service.
                    </p>
                  )}
                  {canBook && !canProceedToBook && (
                    <p className="rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800 ring-1 ring-amber-200">
                      Please select a date and time slot above to book.
                    </p>
                  )}
                  {canBook && bookError && (
                    <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-800 ring-1 ring-red-200">
                      {bookError}
                    </p>
                  )}
                  {canBook && (
                    <Button
                      size="lg"
                      className="bg-amber-400 text-black hover:bg-amber-500"
                      onClick={goToBook}
                      disabled={canProceedToBook === false}
                    >
                      Book now
                    </Button>
                  )}
                </div>
              )}

              <div className="mt-6 border-t border-slate-200 pt-4">
                <p className="text-sm text-slate-600">
                  Sold by{" "}
                  <span className="font-medium text-slate-900">{service.seller?.store?.name ?? "Store"}</span>
                </p>
                <Link
                  href={`/browse?serviceCategoryId=${service.serviceCategory.id}`}
                  className="mt-1 inline-block text-sm text-blue-600 hover:underline"
                >
                  More from {service.serviceCategory.name}
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

          <PublicReviewsSection
            averageRating={service.averageRating}
            totalReviews={service._count.reviews}
            reviews={service.reviews}
          />
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
