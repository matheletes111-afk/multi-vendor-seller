"use client"

import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/ui/dialog"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import {
  Package,
  Wrench,
  UtensilsCrossed,
  Building2,
  Copy,
  Check,
  ExternalLink,
  Store,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
} from "lucide-react"

export interface AddSellerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type SellerTypeOption = {
  type: "PRODUCT" | "SERVICE" | "RESTAURANT" | "HOTEL"
  title: string
  subtitle: string
  desc: string
  path: string
  icon: React.ElementType
  color: {
    bg: string
    border: string
    text: string
    iconBg: string
    accent: string
    ring: string
  }
  tags: string[]
}

const SELLER_OPTIONS: SellerTypeOption[] = [
  {
    type: "PRODUCT",
    title: "Product Seller",
    subtitle: "Physical Goods & Retail",
    desc: "For vendors selling physical goods, apparel, gadgets, cosmetics, and packaged items with parcel shipping & delivery.",
    path: "/product-seller/registration",
    icon: Package,
    color: {
      bg: "hover:bg-blue-50/50 dark:hover:bg-blue-950/20",
      border: "border-blue-200 dark:border-blue-900/50",
      text: "text-blue-700 dark:text-blue-300",
      iconBg: "bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
      accent: "bg-blue-600 hover:bg-blue-700",
      ring: "focus-visible:ring-blue-500",
    },
    tags: ["Inventory Management", "Parcel Shipping", "Discounts & Ads"],
  },
  {
    type: "SERVICE",
    title: "Service Seller",
    subtitle: "Appointments & Home Services",
    desc: "For professionals, technicians, salons, consultants, and contractors offering appointment booking or fixed-rate services.",
    path: "/service-seller/registration",
    icon: Wrench,
    color: {
      bg: "hover:bg-purple-50/50 dark:hover:bg-purple-950/20",
      border: "border-purple-200 dark:border-purple-900/50",
      text: "text-purple-700 dark:text-purple-300",
      iconBg: "bg-purple-600/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400",
      accent: "bg-purple-600 hover:bg-purple-700",
      ring: "focus-visible:ring-purple-500",
    },
    tags: ["Time Slot Scheduler", "Fixed Price Packages", "Booking Calendar"],
  },
  {
    type: "RESTAURANT",
    title: "Restaurant Seller",
    subtitle: "Dining, Cafes & Food",
    desc: "For restaurants, cafes, cloud kitchens, fast food, and bakeries offering food menus, takeaway, and fresh meal delivery.",
    path: "/restaurant-seller/registration",
    icon: UtensilsCrossed,
    color: {
      bg: "hover:bg-amber-50/50 dark:hover:bg-amber-950/20",
      border: "border-amber-200 dark:border-amber-900/50",
      text: "text-amber-700 dark:text-amber-300",
      iconBg: "bg-amber-600/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
      accent: "bg-amber-600 hover:bg-amber-700",
      ring: "focus-visible:ring-amber-500",
    },
    tags: ["Menu & Dish Catalog", "Veg/Non-Veg", "Live Food Orders"],
  },
  {
    type: "HOTEL",
    title: "Hotel Seller",
    subtitle: "Hotels, Resorts & Stays",
    desc: "For hotels, resorts, guesthouses, and properties listing room types, seasonal rates, amenities, and guest bookings.",
    path: "/hotel-seller/registration",
    icon: Building2,
    color: {
      bg: "hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20",
      border: "border-emerald-200 dark:border-emerald-900/50",
      text: "text-emerald-700 dark:text-emerald-300",
      iconBg: "bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
      accent: "bg-emerald-600 hover:bg-emerald-700",
      ring: "focus-visible:ring-emerald-500",
    },
    tags: ["Room Inventory", "Guest Bookings", "Calendar Matrix"],
  },
]

export function AddSellerModal({ open, onOpenChange }: AddSellerModalProps) {
  const [copiedType, setCopiedType] = useState<string | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)

  const getFullUrl = (path: string) => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}${path}`
    }
    return path
  }

  const handleCopyLink = async (path: string, type: string) => {
    const fullUrl = getFullUrl(path)
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullUrl)
      } else {
        const textarea = document.createElement("textarea")
        textarea.value = fullUrl
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
      }
      setCopiedType(type)
      setTimeout(() => setCopiedType(null), 2500)
    } catch {
      // Fallback
      setCopiedType(type)
      setTimeout(() => setCopiedType(null), 2500)
    }
  }

  const handleCopyAllLinks = async () => {
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    const text = SELLER_OPTIONS.map((opt) => `${opt.title}: ${origin}${opt.path}`).join("\n")
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const textarea = document.createElement("textarea")
        textarea.value = text
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
      }
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 2500)
    } catch {
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 2500)
    }
  }

  const handleOpenRegistration = (path: string) => {
    if (typeof window !== "undefined") {
      window.open(path, "_blank", "noopener,noreferrer")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-8">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Add / Register New Seller
                <Badge variant="secondary" className="text-xs font-semibold rounded-full px-2.5 py-0.5">
                  4 Seller Types
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Select the seller business category below to launch the registration form or copy the onboarding link.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* 4 Seller Type Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-2">
          {SELLER_OPTIONS.map((option) => {
            const Icon = option.icon
            const isCopied = copiedType === option.type

            return (
              <div
                key={option.type}
                className={`flex flex-col justify-between p-5 rounded-2xl border bg-card transition-all duration-200 hover:shadow-md ${option.color.border} ${option.color.bg}`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${option.color.iconBg}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm sm:text-base text-foreground flex items-center gap-1.5">
                          {option.title}
                        </h3>
                        <p className={`text-xs font-semibold ${option.color.text}`}>
                          {option.subtitle}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {option.desc}
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {option.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-4 mt-3 border-t border-border/60 flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className={`flex-1 rounded-xl font-semibold text-xs h-9 text-white shadow-sm ${option.color.accent}`}
                    onClick={() => handleOpenRegistration(option.path)}
                  >
                    <span>Register Now</span>
                    <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl h-9 px-3 text-xs font-medium gap-1.5 border-slate-200 dark:border-slate-800"
                    onClick={() => handleCopyLink(option.path, option.type)}
                    title="Copy registration URL"
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-600 font-semibold text-[11px]">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-slate-500" />
                        <span className="text-[11px]">Copy Link</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Informative Workflow Banner */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-start gap-3 text-xs text-slate-600 dark:text-slate-400">
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 shrink-0 mt-0.5">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              How does seller onboarding work?
            </p>
            <p className="leading-relaxed">
              When a seller registers via the link above, they will complete their 6-step onboarding wizard (contact details, business verification documents, KYC identity check, and bank payout information). Once submitted, the application immediately appears in this directory under <strong>Pending Review</strong> for admin verification and approval.
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopyAllLinks}
            className="rounded-xl text-xs font-semibold text-primary gap-1.5 h-9"
          >
            {copiedAll ? (
              <>
                <Check className="h-4 w-4 text-emerald-600" />
                <span className="text-emerald-600">All 4 Registration Links Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Copy All 4 Registration Links</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="secondary"
            className="rounded-xl text-xs font-medium h-9 px-5"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
