/**
 * Universal Admin Data Exporter for All 14 Modules
 *
 * Enforces text formatting ('s', '@') for every cell so phone numbers,
 * account numbers, codes, dates, and currency values are never corrupted,
 * scientific-notated, or stripped of leading zeroes.
 */

import { exportRowsToExcel } from "@/lib/admin-seller-export"

function toSafeString(val: any): string {
  if (val === null || val === undefined) return ""
  if (typeof val === "string") return val.trim()
  if (typeof val === "number" || typeof val === "boolean") return String(val)
  if (val instanceof Date) return val.toISOString()
  if (Array.isArray(val)) {
    return val
      .map((item) => {
        if (typeof item === "object" && item !== null) {
          return item.name || item.title || item.code || JSON.stringify(item)
        }
        return String(item)
      })
      .filter(Boolean)
      .join(", ")
  }
  if (typeof val === "object") {
    return val.name || val.title || val.code || val.label || JSON.stringify(val)
  }
  return String(val)
}

function formatCurrency(val: any, currency = "$"): string {
  if (val === null || val === undefined || val === "") return `${currency}0.00`
  const num = typeof val === "number" ? val : parseFloat(String(val))
  if (isNaN(num)) return `${currency}0.00`
  return `${currency}${num.toFixed(2)}`
}

function formatDate(val: any): string {
  if (!val) return ""
  try {
    const d = new Date(val)
    if (isNaN(d.getTime())) return String(val)
    return d.toISOString().replace("T", " ").substring(0, 19)
  } catch {
    return String(val)
  }
}

function formatPhone(countryCode?: string | null, phone?: string | null): string {
  const code = (countryCode || "").trim()
  const num = (phone || "").trim()
  if (!num) return ""
  if (code && !num.startsWith("+") && !num.startsWith(code)) {
    return `${code} ${num}`
  }
  return num
}

// ─────────────────────────────────────────────────────────────
// 1. RIDERS EXPORT
// ─────────────────────────────────────────────────────────────
export async function exportRidersToExcel(riders: any[], customFilename?: string) {
  const timestamp = new Date().toISOString().substring(0, 10)
  const filename = customFilename || `riders_export_${timestamp}.xlsx`

  const rows: Record<string, string>[] = riders.map((u, idx) => {
    const r = u.rider || {}
    const pay = r.paymentDetails || {}

    let statusText = "Pending"
    if (r.isSuspended) statusText = "Suspended"
    else if (r.status === "APPROVED") statusText = "Approved"
    else if (r.status === "REJECTED") statusText = "Rejected"
    else if (r.status) statusText = toSafeString(r.status)

    const zones = Array.isArray(r.selectedZones) ? r.selectedZones.join(", ") : toSafeString(r.selectedZones)
    const locations = Array.isArray(r.selectedLocations) ? r.selectedLocations.join(", ") : toSafeString(r.selectedLocations)

    return {
      "SL No": String(idx + 1),
      "Rider ID": toSafeString(r.id || u.id),
      "Rider Name": toSafeString(u.name),
      "Email Address": toSafeString(u.email),
      "Phone Number": formatPhone(u.phoneCountryCode, u.phone),
      "Account Status": statusText,
      "Is Suspended": r.isSuspended ? "Yes" : "No",
      "Onboarding Completed": r.onboardingCompleted ? "Yes" : "No",
      "Available / Online": r.isAvailable ? "Online / Available" : "Offline",
      "Vehicle Type": toSafeString(r.vehicleType),
      "Vehicle Name / Model": toSafeString(r.vehicleName),
      "Vehicle Number": toSafeString(r.vehicleNumber),
      "Driving License No": toSafeString(r.drivingLicenseNo),
      "National ID No": toSafeString(r.nidNumber),
      "Rating": toSafeString(r.rating ?? "0.0"),
      "Completed Deliveries": toSafeString(r.completedDeliveries ?? 0),
      "Total Earnings": formatCurrency(r.totalEarnings ?? 0),
      "Cash In Hand / Float": formatCurrency(r.cashInHand ?? 0),
      "Assigned Zones": zones || "All Zones",
      "Assigned Locations": locations || "All Locations",
      "Registration Source": r.createdByAdmin ? "Admin Created" : "Self Registered",
      "Payment Option": toSafeString(r.paymentOption || pay.paymentOption || "Bank"),
      "Bank Name": toSafeString(r.bankName || pay.bankName),
      "Account Holder Name": toSafeString(r.accountHolderName || pay.accountHolderName),
      "Account Number": toSafeString(r.accountNumber || pay.accountNumber),
      "BBAN / Swift": toSafeString(r.bbanNumber || pay.bbanNumber),
      "Branch Name": toSafeString(r.branchName || pay.branchName),
      "Mobile Money Number": toSafeString(r.mobileNumber || pay.mobileNumber),
      "Driving License Doc URL": toSafeString(r.drivingLicenseUrl),
      "National ID Front URL": toSafeString(r.nidFrontUrl),
      "National ID Back URL": toSafeString(r.nidBackUrl),
      "Admin Feedback / Notes": toSafeString(r.adminFeedback || r.adminNotes),
      "Registered Date": formatDate(u.createdAt),
      "Updated Date": formatDate(u.updatedAt),
    }
  })

  await exportRowsToExcel(filename, "Riders Directory", rows)
}

// ─────────────────────────────────────────────────────────────
// 2. SUPPORT TICKETS EXPORT
// ─────────────────────────────────────────────────────────────
export async function exportSupportTicketsToExcel(tickets: any[], customFilename?: string) {
  const timestamp = new Date().toISOString().substring(0, 10)
  const filename = customFilename || `support_tickets_export_${timestamp}.xlsx`

  const rows: Record<string, string>[] = tickets.map((t, idx) => {
    const replies = Array.isArray(t.replies) ? t.replies : []
    const lastReply = replies.length > 0 ? replies[replies.length - 1] : null

    return {
      "SL No": String(idx + 1),
      "Ticket ID": toSafeString(t.ticketId || t.id),
      "Subject": toSafeString(t.subject),
      "Requester Name": toSafeString(t.name),
      "Email Address": toSafeString(t.email),
      "Mobile Number": toSafeString(t.mobile),
      "User Type": toSafeString(t.userType || "Guest"),
      "Ticket Source": t.source === "IN_APP" ? "In-App User" : "Public / Web Form",
      "Status": toSafeString(t.status),
      "Priority": toSafeString(t.priority || "NORMAL"),
      "Category": toSafeString(t.category || "General"),
      "Replies Count": String(replies.length),
      "Latest Reply By": toSafeString(lastReply?.senderType),
      "Latest Reply Message": toSafeString(lastReply?.message),
      "Created At": formatDate(t.createdAt),
      "Last Activity": formatDate(t.updatedAt),
    }
  })

  await exportRowsToExcel(filename, "Support Tickets", rows)
}

// ─────────────────────────────────────────────────────────────
// 3. SUBSCRIPTIONS EXPORT
// ─────────────────────────────────────────────────────────────
export async function exportSubscriptionsToExcel(subs: any[], customFilename?: string) {
  const timestamp = new Date().toISOString().substring(0, 10)
  const filename = customFilename || `subscriptions_export_${timestamp}.xlsx`

  const rows: Record<string, string>[] = subs.map((s, idx) => {
    const plan = s.plan || {}
    const seller = s.seller || s.hotelSeller || s.restaurantSeller || {}
    const store = seller.store || seller.businessInfo || {}
    const user = seller.user || {}

    return {
      "SL No": String(idx + 1),
      "Subscription ID": toSafeString(s.id),
      "Seller Type": toSafeString(seller.type || s.type || "PRODUCT_SERVICE"),
      "Store / Business Name": toSafeString(store.name || store.businessName),
      "Owner Name": toSafeString(user.name),
      "Email Address": toSafeString(user.email),
      "Phone Number": toSafeString(user.phone),
      "Plan Name": toSafeString(plan.displayName || plan.name),
      "Plan Tier / Type": toSafeString(plan.type || s.type),
      "Plan Price": formatCurrency(plan.price),
      "Paid Price": formatCurrency(s.paidPrice ?? plan.price),
      "Billing Interval": toSafeString(plan.interval || s.interval || "MONTHLY"),
      "Subscription Status": toSafeString(s.status),
      "Auto Renew": s.autoRenew ? "Yes" : "No",
      "Start Date": formatDate(s.startDate || s.createdAt),
      "End Date": formatDate(s.endDate || s.expiresAt),
      "Payment Method": toSafeString(s.paymentMethod || "Direct Payment"),
      "Payment Status": toSafeString(s.paymentStatus || (s.status === "ACTIVE" ? "PAID" : "PENDING")),
      "Created Date": formatDate(s.createdAt),
    }
  })

  await exportRowsToExcel(filename, "Subscriptions", rows)
}

// ─────────────────────────────────────────────────────────────
// 4. ADS (SELLER ADS) EXPORT
// ─────────────────────────────────────────────────────────────
export async function exportAdsToExcel(ads: any[], customFilename?: string) {
  const timestamp = new Date().toISOString().substring(0, 10)
  const filename = customFilename || `seller_ads_export_${timestamp}.xlsx`

  const rows: Record<string, string>[] = ads.map((ad, idx) => {
    const seller = ad.seller || ad.hotelSeller || ad.restaurantSeller || {}
    const store = seller.store || seller.businessInfo || {}
    const user = seller.user || ad.customer || {}
    const targetEntity = ad.product?.name || ad.service?.name || ad.hotel?.name || ad.foodItem?.name || ad.linkUrl || "Store Profile"

    return {
      "SL No": String(idx + 1),
      "Ad ID": toSafeString(ad.id),
      "Ad Title": toSafeString(ad.title),
      "Ad Placement / Type": toSafeString(ad.placement || ad.type || "Banner"),
      "Advertiser Name": toSafeString(user.name || store.name),
      "Advertiser Email": toSafeString(user.email),
      "Store / Business Name": toSafeString(store.name || store.businessName),
      "Status": toSafeString(ad.status),
      "Target Item / Link": toSafeString(targetEntity),
      "Budget / Spent Amount": formatCurrency(ad.spentAmount ?? ad.budget ?? 0),
      "Total Budget": formatCurrency(ad.totalBudget ?? ad.budget ?? 0),
      "Impressions": toSafeString(ad.impressions ?? 0),
      "Clicks": toSafeString(ad.clicks ?? 0),
      "CTR (%)": ad.impressions ? `${(((ad.clicks ?? 0) / ad.impressions) * 100).toFixed(2)}%` : "0.00%",
      "Banner Image URL": toSafeString(ad.imageUrl || ad.bannerUrl),
      "Start Date": formatDate(ad.startDate),
      "End Date": formatDate(ad.endDate),
      "Admin Note / Rejection Reason": toSafeString(ad.adminNote || ad.rejectionReason),
      "Created At": formatDate(ad.createdAt),
    }
  })

  await exportRowsToExcel(filename, "Seller Advertisements", rows)
}

// ─────────────────────────────────────────────────────────────
// 5. COUPONS EXPORT
// ─────────────────────────────────────────────────────────────
export async function exportCouponsToExcel(coupons: any[], customFilename?: string) {
  const timestamp = new Date().toISOString().substring(0, 10)
  const filename = customFilename || `coupons_export_${timestamp}.xlsx`

  const rows: Record<string, string>[] = coupons.map((c, idx) => {
    const usagesCount = Array.isArray(c.usages) ? c.usages.length : (c.usedCount ?? 0)
    const discountStr = c.discountType === "PERCENTAGE" ? `${c.discountValue}%` : formatCurrency(c.discountValue)

    return {
      "SL No": String(idx + 1),
      "Coupon ID": toSafeString(c.id),
      "Coupon Code": toSafeString(c.code),
      "Description": toSafeString(c.description),
      "Discount Type": toSafeString(c.discountType),
      "Discount Value": discountStr,
      "Minimum Order Amount": formatCurrency(c.minOrderAmount ?? 0),
      "Maximum Discount": formatCurrency(c.maxDiscount ?? 0),
      "Total Usage Limit": toSafeString(c.usageLimit ?? "Unlimited"),
      "Usage Limit Per User": toSafeString(c.userLimit ?? c.usageLimitPerUser ?? 1),
      "Times Used": String(usagesCount),
      "Status": c.isActive ? "Active" : "Inactive",
      "Valid From": formatDate(c.startDate || c.validFrom),
      "Valid Until / Expires": formatDate(c.endDate || c.expiryDate),
      "Created At": formatDate(c.createdAt),
    }
  })

  await exportRowsToExcel(filename, "Coupons", rows)
}

// ─────────────────────────────────────────────────────────────
// 6. PRODUCT CATEGORIES EXPORT
// ─────────────────────────────────────────────────────────────
export async function exportProductCategoriesToExcel(categories: any[], customFilename?: string) {
  const timestamp = new Date().toISOString().substring(0, 10)
  const filename = customFilename || `product_categories_export_${timestamp}.xlsx`

  const rows: Record<string, string>[] = categories.map((cat, idx) => {
    const subcats = Array.isArray(cat.subcategories) ? cat.subcategories.map((sc: any) => sc.name).join(", ") : ""

    return {
      "SL No": String(idx + 1),
      "Category ID": toSafeString(cat.id),
      "Category Name": toSafeString(cat.name),
      "Slug": toSafeString(cat.slug),
      "Total Products": toSafeString(cat._count?.products ?? 0),
      "Total Subcategories": toSafeString(cat._count?.subcategories ?? cat.subcategories?.length ?? 0),
      "Subcategories List": subcats || "None",
      "Status": cat.isActive === false ? "Inactive" : "Active",
      "Priority / Sort Order": toSafeString(cat.priority ?? 0),
      "Icon / Image URL": toSafeString(cat.image || cat.icon),
      "Created At": formatDate(cat.createdAt),
    }
  })

  await exportRowsToExcel(filename, "Product Categories", rows)
}

// ─────────────────────────────────────────────────────────────
// 7. PRODUCTS EXPORT
// ─────────────────────────────────────────────────────────────
export async function exportProductsToExcel(products: any[], customFilename?: string) {
  const timestamp = new Date().toISOString().substring(0, 10)
  const filename = customFilename || `products_export_${timestamp}.xlsx`

  const rows: Record<string, string>[] = products.map((p, idx) => {
    const variants = Array.isArray(p.variants) ? p.variants : []
    const basePrice = variants.length > 0 ? variants[0].price : (p.price ?? 0)
    const totalStock = variants.reduce((sum: number, v: any) => sum + (v.stockQuantity ?? 0), 0)
    const skus = variants.map((v: any) => v.sku).filter(Boolean).join(", ")

    return {
      "SL No": String(idx + 1),
      "Product ID": toSafeString(p.id),
      "Product Name": toSafeString(p.name),
      "SKU(s)": skus || toSafeString(p.sku),
      "Category": toSafeString(p.category?.name),
      "Subcategory": toSafeString(p.subcategory?.name),
      "Store Name": toSafeString(p.seller?.store?.name),
      "Seller Email": toSafeString(p.seller?.user?.email),
      "Status": p.isActive ? "Active" : "Inactive",
      "Condition": toSafeString(p.condition || "NEW"),
      "Base Price": formatCurrency(basePrice),
      "Variants Count": String(variants.length),
      "Total Stock Quantity": String(totalStock),
      "Total Orders / Sold": toSafeString(p._count?.orderItems ?? 0),
      "Total Reviews": toSafeString(p._count?.reviews ?? 0),
      "Average Rating": toSafeString(p.averageRating ?? "0.0"),
      "Main Image URL": toSafeString(Array.isArray(p.images) ? p.images[0] : p.images),
      "Created At": formatDate(p.createdAt),
      "Last Updated": formatDate(p.updatedAt),
    }
  })

  await exportRowsToExcel(filename, "Products Directory", rows)
}

// ─────────────────────────────────────────────────────────────
// 8. SERVICE CATEGORIES EXPORT
// ─────────────────────────────────────────────────────────────
export async function exportServiceCategoriesToExcel(categories: any[], customFilename?: string) {
  const timestamp = new Date().toISOString().substring(0, 10)
  const filename = customFilename || `service_categories_export_${timestamp}.xlsx`

  const rows: Record<string, string>[] = categories.map((cat, idx) => {
    return {
      "SL No": String(idx + 1),
      "Category ID": toSafeString(cat.id),
      "Category Name": toSafeString(cat.name),
      "Slug": toSafeString(cat.slug),
      "Total Services": toSafeString(cat._count?.services ?? 0),
      "Status": cat.isActive === false ? "Inactive" : "Active",
      "Sort Order": toSafeString(cat.priority ?? 0),
      "Icon / Image URL": toSafeString(cat.image || cat.icon),
      "Created At": formatDate(cat.createdAt),
    }
  })

  await exportRowsToExcel(filename, "Service Categories", rows)
}

// ─────────────────────────────────────────────────────────────
// 9. SERVICES EXPORT
// ─────────────────────────────────────────────────────────────
export async function exportServicesToExcel(services: any[], customFilename?: string) {
  const timestamp = new Date().toISOString().substring(0, 10)
  const filename = customFilename || `services_export_${timestamp}.xlsx`

  const rows: Record<string, string>[] = services.map((s, idx) => {
    return {
      "SL No": String(idx + 1),
      "Service ID": toSafeString(s.id),
      "Service Name": toSafeString(s.name),
      "Category": toSafeString(s.serviceCategory?.name || s.category?.name),
      "Provider Store Name": toSafeString(s.seller?.store?.name),
      "Provider Email": toSafeString(s.seller?.user?.email),
      "Provider Phone": toSafeString(s.seller?.user?.phone || s.seller?.store?.phone),
      "Status": s.isActive ? "Active" : "Inactive",
      "Pricing Model": toSafeString(s.pricingModel || s.priceType || "Fixed"),
      "Price": formatCurrency(s.price),
      "Duration": toSafeString(s.duration ? `${s.duration} mins` : "Flexible"),
      "City / Area": toSafeString(s.city || s.seller?.store?.city),
      "Total Orders / Bookings": toSafeString(s._count?.orderItems ?? 0),
      "Total Reviews": toSafeString(s._count?.reviews ?? 0),
      "Average Rating": toSafeString(s.averageRating ?? "0.0"),
      "Main Image URL": toSafeString(Array.isArray(s.images) ? s.images[0] : s.images),
      "Created At": formatDate(s.createdAt),
    }
  })

  await exportRowsToExcel(filename, "Services Directory", rows)
}

// ─────────────────────────────────────────────────────────────
// 10. PRODUCT / SERVICE ORDERS EXPORT
// ─────────────────────────────────────────────────────────────
export async function exportOrdersToExcel(orders: any[], customFilename?: string) {
  const timestamp = new Date().toISOString().substring(0, 10)
  const filename = customFilename || `orders_export_${timestamp}.xlsx`

  const rows: Record<string, string>[] = orders.map((o, idx) => {
    const items = Array.isArray(o.items) ? o.items : []
    const itemsList = items
      .map((it: any) => `${it.productNameSnapshot || it.serviceNameSnapshot || "Item"} (x${it.quantity || 1})`)
      .join("; ")

    return {
      "SL No": String(idx + 1),
      "Order Number": toSafeString(o.orderNumber || o.id),
      "Order Status": toSafeString(o.status),
      "Customer Name": toSafeString(o.customerName || o.customer?.name),
      "Customer Email": toSafeString(o.customerEmail || o.customer?.email),
      "Store / Seller": toSafeString(o.sellerStoreName || o.seller?.store?.name),
      "Total Items Count": toSafeString(o.itemCount ?? items.length),
      "Items Summary": itemsList || "N/A",
      "Total Amount": formatCurrency(o.totalAmount),
      "Commission Amount": formatCurrency(o.commission ?? 0),
      "Commission Rate (%)": `${toSafeString(o.commissionRate ?? 10)}%`,
      "Payment Method": toSafeString(o.paymentMethod || "COD"),
      "Payment Status": toSafeString(o.paymentStatus || "PENDING"),
      "Order Date": formatDate(o.createdAt),
    }
  })

  await exportRowsToExcel(filename, "Orders Directory", rows)
}

// ─────────────────────────────────────────────────────────────
// 11. HOTELS EXPORT
// ─────────────────────────────────────────────────────────────
export async function exportHotelsToExcel(hotels: any[], customFilename?: string) {
  const timestamp = new Date().toISOString().substring(0, 10)
  const filename = customFilename || `hotels_export_${timestamp}.xlsx`

  const rows: Record<string, string>[] = hotels.map((h, idx) => {
    const seller = h.hotelSeller || {}
    const busInfo = seller.businessInfo || {}
    const user = seller.user || {}
    const roomsCount = Array.isArray(h.rooms) ? h.rooms.length : (h._count?.rooms ?? 0)

    return {
      "SL No": String(idx + 1),
      "Hotel ID": toSafeString(h.id),
      "Hotel Name": toSafeString(h.name),
      "Business Name": toSafeString(busInfo.businessName || h.name),
      "Contact Person": toSafeString(user.name || busInfo.pocName),
      "Email Address": toSafeString(user.email),
      "Phone Number": toSafeString(user.phone || busInfo.pocContact || h.phone),
      "City": toSafeString(h.city || busInfo.city),
      "State / Region": toSafeString(h.state || busInfo.state),
      "Full Address": toSafeString(h.address || busInfo.address),
      "Status": h.isActive ? "Active" : "Inactive",
      "Total Rooms / Types": String(roomsCount),
      "Star Rating": toSafeString(h.starRating ?? "N/A"),
      "Average Rating": toSafeString(h.rating ?? "0.0"),
      "Total Bookings": toSafeString(h._count?.bookings ?? 0),
      "Main Photo URL": toSafeString(Array.isArray(h.images) ? h.images[0] : (h.image || h.mainPhoto)),
      "Created At": formatDate(h.createdAt),
    }
  })

  await exportRowsToExcel(filename, "Hotels Directory", rows)
}

// ─────────────────────────────────────────────────────────────
// 12. HOTEL BOOKINGS EXPORT
// ─────────────────────────────────────────────────────────────
export async function exportBookingsToExcel(bookings: any[], customFilename?: string) {
  const timestamp = new Date().toISOString().substring(0, 10)
  const filename = customFilename || `hotel_bookings_export_${timestamp}.xlsx`

  const rows: Record<string, string>[] = bookings.map((b, idx) => {
    return {
      "SL No": String(idx + 1),
      "Booking Reference": toSafeString(b.bookingNumber || b.id),
      "Hotel Name": toSafeString(b.hotel?.name),
      "Room Name / Type": toSafeString(b.room?.name || b.roomType),
      "Guest Name": toSafeString(b.guestName || b.user?.name),
      "Guest Email": toSafeString(b.guestEmail || b.user?.email),
      "Guest Phone": toSafeString(b.guestPhone),
      "Guests Count": toSafeString(b.guestsCount || b.numberOfGuests || 1),
      "Check-In Date": formatDate(b.checkIn),
      "Check-Out Date": formatDate(b.checkOut),
      "Booking Status": toSafeString(b.status),
      "Total Price": formatCurrency(b.totalPrice ?? b.totalAmount ?? 0),
      "Payment Status": toSafeString(b.paymentStatus || "PENDING"),
      "Special Requests": toSafeString(b.specialRequests || "None"),
      "Booked At": formatDate(b.createdAt),
    }
  })

  await exportRowsToExcel(filename, "Hotel Bookings", rows)
}

// ─────────────────────────────────────────────────────────────
// 13. FOOD ITEMS EXPORT
// ─────────────────────────────────────────────────────────────
export async function exportFoodItemsToExcel(foods: any[], customFilename?: string) {
  const timestamp = new Date().toISOString().substring(0, 10)
  const filename = customFilename || `restaurant_food_items_export_${timestamp}.xlsx`

  const rows: Record<string, string>[] = foods.map((f, idx) => {
    const restaurant = f.restaurantSeller || {}
    const busInfo = restaurant.businessInfo || {}
    const user = restaurant.user || {}

    return {
      "SL No": String(idx + 1),
      "Food ID": toSafeString(f.id),
      "Food Name": toSafeString(f.name),
      "Restaurant Name": toSafeString(busInfo.businessName || f.restaurantName || "Restaurant"),
      "Owner Name": toSafeString(user.name),
      "Category / Cuisine": toSafeString(f.category || f.cuisine),
      "Price": formatCurrency(f.price),
      "Discount Price": f.discountPrice ? formatCurrency(f.discountPrice) : "None",
      "Status": (f.isActive !== false && f.isAvailable !== false) ? "Available" : "Unavailable",
      "Is Vegetarian": f.isVeg ? "Yes (Veg)" : "No (Non-Veg)",
      "Preparation Time": toSafeString(f.preparationTime ? `${f.preparationTime} mins` : "15-20 mins"),
      "Main Image URL": toSafeString(f.image || (Array.isArray(f.images) ? f.images[0] : f.images)),
      "Created At": formatDate(f.createdAt),
    }
  })

  await exportRowsToExcel(filename, "Food Items", rows)
}

// ─────────────────────────────────────────────────────────────
// 14. RESTAURANT ORDERS EXPORT
// ─────────────────────────────────────────────────────────────
export async function exportRestaurantOrdersToExcel(orders: any[], customFilename?: string) {
  const timestamp = new Date().toISOString().substring(0, 10)
  const filename = customFilename || `restaurant_orders_export_${timestamp}.xlsx`

  const rows: Record<string, string>[] = orders.map((o, idx) => {
    const restaurant = o.restaurantSeller || {}
    const busInfo = restaurant.businessInfo || {}
    const customer = o.customer || {}
    const items = Array.isArray(o.items) ? o.items : []
    const itemsSummary = items
      .map((it: any) => `${it.foodName || it.name || "Item"} (x${it.quantity || 1})`)
      .join("; ")

    return {
      "SL No": String(idx + 1),
      "Order Number": toSafeString(o.orderNumber || o.id),
      "Restaurant Name": toSafeString(busInfo.businessName || o.restaurantName || "Restaurant"),
      "Customer Name": toSafeString(o.deliveryFullName || o.customerName || customer.name || "Customer"),
      "Customer Phone": toSafeString(o.deliveryPhone || o.customerPhone || customer.phone),
      "Delivery Address": toSafeString(o.deliveryAddress),
      "Landmark": toSafeString(o.deliveryLandmark),
      "Order Status": toSafeString(o.status),
      "Items Count": String(items.length || o.itemsCount || 0),
      "Items Breakdown": itemsSummary || "N/A",
      "Subtotal": formatCurrency(o.subtotal ?? 0),
      "Delivery Fee": formatCurrency(o.deliveryFee ?? 0),
      "Coupon Code": toSafeString(o.couponCode || "None"),
      "Coupon Discount": o.couponDiscount ? formatCurrency(o.couponDiscount) : "$0.00",
      "Total Amount": formatCurrency(o.totalAmount ?? 0),
      "Payment Method": toSafeString(o.paymentMethod || "COD"),
      "Payment Status": toSafeString(o.paymentStatus || "PENDING"),
      "Special Instructions": toSafeString(o.specialInstructions || "None"),
      "Order Placed At": formatDate(o.createdAt),
    }
  })

  await exportRowsToExcel(filename, "Restaurant Orders", rows)
}
