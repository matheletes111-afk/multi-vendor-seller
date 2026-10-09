/**
 * Backoffice Role & Permission Module Registry
 *
 * Maps all 21 admin sidebar modules to their allowed route prefixes.
 * Controls sidebar visibility and URL route guards.
 */

export interface PermissionModule {
  key: string
  label: string
  category: "Master" | "Products & Services" | "Hotels" | "Restaurants"
  description: string
  basePath: string
  allowedPrefixes: string[]
}

export const BACKOFFICE_MODULES: PermissionModule[] = [
  // ── 1. MASTER CATEGORY ──
  {
    key: "dashboard",
    label: "Dashboard Overview",
    category: "Master",
    description: "Main administrative analytics, GMV, transactions, and charts",
    basePath: "/admin",
    allowedPrefixes: ["/admin", "/api/admin/overview"],
  },
  {
    key: "all-sellers",
    label: "All Sellers Master",
    category: "Master",
    description: "Directory of all 4 vendor categories, moderation, and verification",
    basePath: "/admin/all-sellers",
    allowedPrefixes: ["/admin/all-sellers", "/api/admin/all-sellers"],
  },
  {
    key: "riders",
    label: "Riders Fleet",
    category: "Master",
    description: "Rider accounts, driver licenses, approvals, and live GPS tracking",
    basePath: "/admin/riders",
    allowedPrefixes: ["/admin/riders", "/api/admin/riders"],
  },
  {
    key: "support",
    label: "Support Tickets",
    category: "Master",
    description: "Customer and vendor support tickets, replies, and resolution",
    basePath: "/admin/support",
    allowedPrefixes: ["/admin/support", "/api/admin/support"],
  },
  {
    key: "banners",
    label: "Promotional Banners",
    category: "Master",
    description: "Home and category banners, hero slides, and promotions",
    basePath: "/admin/banners",
    allowedPrefixes: ["/admin/banners", "/api/admin/banners"],
  },
  {
    key: "subscriptions",
    label: "Vendor Subscriptions",
    category: "Master",
    description: "Subscription tiers, active vendor billing, and invoice logs",
    basePath: "/admin/subscriptions",
    allowedPrefixes: ["/admin/subscriptions", "/api/admin/subscriptions"],
  },
  {
    key: "seller-ads",
    label: "Seller Ads",
    category: "Master",
    description: "Sponsored vendor ads, budget approvals, and impression tracking",
    basePath: "/admin/seller-ads",
    allowedPrefixes: ["/admin/seller-ads", "/api/admin/seller-ads"],
  },
  {
    key: "reviews",
    label: "Customer Reviews",
    category: "Master",
    description: "Reviews and ratings moderation for products, hotels, and restaurants",
    basePath: "/admin/reviews",
    allowedPrefixes: ["/admin/reviews", "/api/admin/reviews"],
  },
  {
    key: "settings",
    label: "Platform Settings",
    category: "Master",
    description: "General system configurations and maintenance controls",
    basePath: "/admin/settings",
    allowedPrefixes: ["/admin/settings", "/api/admin/settings"],
  },
  {
    key: "coupons",
    label: "Coupons & Discounts",
    category: "Master",
    description: "Promo codes, percentage/fixed discounts, and usage limits",
    basePath: "/admin/coupons",
    allowedPrefixes: ["/admin/coupons", "/api/admin/coupons"],
  },
  {
    key: "seller-drip-campaigns",
    label: "Seller Daily Emails",
    category: "Master",
    description: "7-day onboarding and re-engagement email templates for all 4 seller types",
    basePath: "/admin/seller-drip-campaigns",
    allowedPrefixes: ["/admin/seller-drip-campaigns", "/api/admin/seller-drip-campaigns"],
  },


  // ── 2. PRODUCTS & SERVICES ──
  {
    key: "categories",
    label: "Product Categories",
    category: "Products & Services",
    description: "Product categories, subcategories, icons, and display ordering",
    basePath: "/admin/categories",
    allowedPrefixes: ["/admin/categories", "/api/admin/categories"],
  },
  {
    key: "products",
    label: "Products Inventory",
    category: "Products & Services",
    description: "Physical goods inventory, SKUs, variants, prices, and stock",
    basePath: "/admin/products",
    allowedPrefixes: ["/admin/products", "/api/admin/products"],
  },
  {
    key: "service-categories",
    label: "Service Categories",
    category: "Products & Services",
    description: "Categories for professional services and maintenance",
    basePath: "/admin/service-categories",
    allowedPrefixes: ["/admin/service-categories", "/api/admin/service-categories"],
  },
  {
    key: "services",
    label: "Services Catalog",
    category: "Products & Services",
    description: "Listed service packages, slots, pricing, and provider moderation",
    basePath: "/admin/services",
    allowedPrefixes: ["/admin/services", "/api/admin/services"],
  },
  {
    key: "sellers",
    label: "Product & Service Sellers",
    category: "Products & Services",
    description: "Vendor store management for ecommerce goods and services",
    basePath: "/admin/sellers",
    allowedPrefixes: ["/admin/sellers", "/api/admin/sellers"],
  },
  {
    key: "orders",
    label: "Product & Service Orders",
    category: "Products & Services",
    description: "Customer purchases, item fulfillment, status, and commissions",
    basePath: "/admin/orders",
    allowedPrefixes: ["/admin/orders", "/api/admin/orders"],
  },

  // ── 3. HOTELS ──
  {
    key: "hotel-sellers",
    label: "Hotel Sellers",
    category: "Hotels",
    description: "Hotel vendor partners, business KYC, and property verifications",
    basePath: "/admin/hotel-sellers",
    allowedPrefixes: ["/admin/hotel-sellers", "/api/admin/hotel-sellers"],
  },
  {
    key: "hotels",
    label: "Hotels & Properties",
    category: "Hotels",
    description: "Registered hotel properties, amenities, rooms, and photos",
    basePath: "/admin/hotels",
    allowedPrefixes: ["/admin/hotels", "/api/admin/hotels"],
  },
  {
    key: "bookings",
    label: "Hotel Bookings",
    category: "Hotels",
    description: "Guest room bookings, check-in dates, guest contact, and payments",
    basePath: "/admin/bookings",
    allowedPrefixes: ["/admin/bookings", "/api/admin/bookings"],
  },

  // ── 4. RESTAURANTS ──
  {
    key: "restaurant-sellers",
    label: "Restaurant Sellers",
    category: "Restaurants",
    description: "Restaurant partners, food licenses, addresses, and contacts",
    basePath: "/admin/restaurant-sellers",
    allowedPrefixes: ["/admin/restaurant-sellers", "/api/admin/restaurant-sellers"],
  },
  {
    key: "restaurant-foods",
    label: "Restaurant Foods",
    category: "Restaurants",
    description: "Dishes, cuisines, menu items, dietary tags, and preparation times",
    basePath: "/admin/restaurant-foods",
    allowedPrefixes: ["/admin/restaurant-foods", "/api/admin/restaurant-foods"],
  },
  {
    key: "restaurant-orders",
    label: "Restaurant Orders",
    category: "Restaurants",
    description: "Food deliveries, customer addresses, order statuses, and totals",
    basePath: "/admin/restaurant-orders",
    allowedPrefixes: ["/admin/restaurant-orders", "/api/admin/restaurant-orders"],
  },
]

/**
 * Super Admin-only routes that NO staff role can ever be granted.
 */
export const SUPER_ADMIN_ONLY_PREFIXES = [
  "/admin/roles",
  "/api/admin/roles",
  "/api/admin/backoffice-users",
]

/**
 * Check whether a requested pathname matches any allowed prefix for a module key.
 */
export function isPathMatchingModule(pathname: string, moduleKey: string): boolean {
  const mod = BACKOFFICE_MODULES.find((m) => m.key === moduleKey)
  if (!mod) return false

  // Special exact check for root admin dashboard
  if (moduleKey === "dashboard") {
    return pathname === "/admin" || pathname === "/admin/" || pathname.startsWith("/api/admin/overview")
  }

  return mod.allowedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

/**
 * Check whether a pathname is accessible given an array of granted module keys.
 */
export function isPathPermitted(pathname: string, permissions: string[] | null | undefined): boolean {
  if (!permissions || !Array.isArray(permissions)) return false
  return permissions.some((key) => isPathMatchingModule(pathname, key))
}

/**
 * Get the initial landing page URL based on user's granted permissions.
 * If user has "dashboard", returns "/admin", otherwise returns the first granted module's basePath.
 */
export function getFirstAllowedPath(permissions: string[] | null | undefined): string {
  if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
    return "/admin"
  }
  if (permissions.includes("dashboard")) {
    return "/admin"
  }
  for (const mod of BACKOFFICE_MODULES) {
    if (permissions.includes(mod.key)) {
      return mod.basePath
    }
  }
  return "/admin"
}

/**
 * Group modules by category for rendering in Role Create/Edit permission matrix.
 */
export function getModulesByCategory() {
  const categories: Record<string, PermissionModule[]> = {
    Master: [],
    "Products & Services": [],
    Hotels: [],
    Restaurants: [],
  }

  for (const mod of BACKOFFICE_MODULES) {
    if (categories[mod.category]) {
      categories[mod.category].push(mod)
    }
  }

  return categories
}
