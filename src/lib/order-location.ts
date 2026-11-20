import { prisma } from "@/lib/prisma"

export interface CoordinatePair {
  latitude: number
  longitude: number
}

export interface OrderLocationPoint {
  name: string | null
  address: string
  latitude: number | null
  longitude: number | null
  phone: string | null
}

interface CacheEntry {
  coords: CoordinatePair | null
  expiresAt: number
}

const SUCCESS_TTL_MS = 6 * 60 * 60 * 1000
const FAILURE_TTL_MS = 5 * 60 * 1000
const GOOGLE_DENIED_COOLDOWN_MS = 10 * 60 * 1000
const MAX_CACHE_ENTRIES = 500
const GEOCODE_TIMEOUT_MS = 1800

const geocodeCache = new Map<string, CacheEntry>()
const inFlightGeocodes = new Map<string, Promise<CoordinatePair | null>>()
let googleGeocodeDeniedUntil = 0

/**
 * Parses an optional numeric coordinate input, rejecting empty strings and non-finite values.
 */
export function parseOptionalCoordNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === "string" && val.trim() === "") return null
  const num = Number(val)
  return Number.isFinite(num) ? num : null
}

/**
 * Validates and normalizes a latitude/longitude pair, rejecting missing,
 * non-finite, out-of-range, or uninitialized (0, 0) coordinate pairs.
 */
export function toValidCoordPair(latVal: unknown, lngVal: unknown): CoordinatePair | null {
  if (latVal === null || latVal === undefined || latVal === "") return null
  if (lngVal === null || lngVal === undefined || lngVal === "") return null

  const lat = Number(latVal)
  const lng = Number(lngVal)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) return null

  return { latitude: lat, longitude: lng }
}

/**
 * Joins non-empty address segments while removing consecutive duplicates
 * (case-insensitive) such as repeated city/state values.
 */
export function formatLocationAddress(parts: Array<string | null | undefined>): string {
  const cleaned: string[] = []
  for (const part of parts) {
    if (typeof part !== "string") continue
    const trimmed = part.trim()
    if (!trimmed) continue
    const prev = cleaned[cleaned.length - 1]
    if (prev && prev.toLowerCase() === trimmed.toLowerCase()) continue
    cleaned.push(trimmed)
  }
  return cleaned.join(", ")
}

function setCachedGeocode(key: string, coords: CoordinatePair | null): void {
  if (geocodeCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = geocodeCache.keys().next().value
    if (oldestKey !== undefined) {
      geocodeCache.delete(oldestKey)
    }
  }
  geocodeCache.set(key, {
    coords,
    expiresAt: Date.now() + (coords ? SUCCESS_TTL_MS : FAILURE_TTL_MS),
  })
}

async function fetchGoogleGeocode(address: string): Promise<CoordinatePair | null> {
  if (Date.now() < googleGeocodeDeniedUntil) return null
  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.MAP_KEY
  if (!apiKey) return null

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${encodeURIComponent(apiKey)}`
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS),
      cache: "no-store",
    })
    if (!res.ok) return null

    const data = await res.json().catch(() => null)
    if (data?.status === "OK" && Array.isArray(data.results) && data.results.length > 0) {
      const loc = data.results[0]?.geometry?.location
      return toValidCoordPair(loc?.lat, loc?.lng)
    }
    if (data?.status === "REQUEST_DENIED" || data?.status === "OVER_DAILY_LIMIT") {
      googleGeocodeDeniedUntil = Date.now() + GOOGLE_DENIED_COOLDOWN_MS
    }
    return null
  } catch {
    return null
  }
}

async function fetchNominatimGeocode(address: string): Promise<CoordinatePair | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "MeeemMarketplace/1.0 (delivery-location-resolver)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS),
      cache: "no-store",
    })
    if (!res.ok) return null

    const rows = await res.json().catch(() => null)
    if (Array.isArray(rows) && rows.length > 0) {
      return toValidCoordPair(rows[0]?.lat, rows[0]?.lon)
    }
    return null
  } catch {
    return null
  }
}

/**
 * Resolves a formatted text address to latitude/longitude coordinates using
 * Google Geocoding REST API (primary) and OpenStreetMap Nominatim (fallback),
 * with in-memory TTL caching and concurrent request coalescing.
 */
export async function geocodeAddressServer(rawAddress: string): Promise<CoordinatePair | null> {
  const clean = rawAddress.trim()
  if (clean.length < 4) return null

  const cacheKey = clean.toLowerCase()
  const cached = geocodeCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.coords
  }
  if (cached) {
    geocodeCache.delete(cacheKey)
  }

  const existingPromise = inFlightGeocodes.get(cacheKey)
  if (existingPromise) {
    return existingPromise
  }

  const pending = (async (): Promise<CoordinatePair | null> => {
    try {
      const googleCoords = await fetchGoogleGeocode(clean)
      if (googleCoords) {
        setCachedGeocode(cacheKey, googleCoords)
        return googleCoords
      }

      const nominatimCoords = await fetchNominatimGeocode(clean)
      setCachedGeocode(cacheKey, nominatimCoords)
      return nominatimCoords
    } catch {
      setCachedGeocode(cacheKey, null)
      return null
    } finally {
      inFlightGeocodes.delete(cacheKey)
    }
  })()

  inFlightGeocodes.set(cacheKey, pending)
  return pending
}

/**
 * Returns valid explicit coordinates if present; otherwise geocodes the text address.
 */
export async function resolveOrGeocodeAddressCoords(
  explicitLat: unknown,
  explicitLng: unknown,
  addressParts: Array<string | null | undefined>
): Promise<CoordinatePair | null> {
  const explicit = toValidCoordPair(explicitLat, explicitLng)
  if (explicit) return explicit

  const address = formatLocationAddress(addressParts)
  if (!address) return null
  return geocodeAddressServer(address)
}

/**
 * Synchronously extracts the pickup location snapshot from an assignment/seller record,
 * preferring assignment snapshot -> seller.businessInfo -> seller.store coordinates.
 */
export function extractSellerPickupData(seller: any, assignment?: any): OrderLocationPoint {
  const biz = seller?.businessInfo
  const store = seller?.store
  const name: string | null = store?.name || biz?.businessName || seller?.user?.name || "Seller Store"

  const bizAddr = formatLocationAddress([biz?.street, biz?.city, biz?.district, biz?.postalCode])
  const storeAddr = formatLocationAddress([
    store?.address,
    store?.city,
    store?.state,
    store?.zipCode,
    store?.country,
  ])
  const address = bizAddr || storeAddr || ""
  const phone: string | null = store?.phone || seller?.user?.phone || biz?.pocContact || null

  const coords =
    toValidCoordPair(assignment?.sellerLatitude, assignment?.sellerLongitude) ??
    toValidCoordPair(biz?.latitude, biz?.longitude) ??
    toValidCoordPair(store?.lat, store?.lng)

  return {
    name,
    address,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    phone,
  }
}

/**
 * Synchronously extracts the customer dropoff location snapshot from an Order record,
 * preferring dedicated shippingLatitude/Longitude columns over legacy shippingAddress JSON.
 */
export function extractOrderDropoffData(order: any): OrderLocationPoint {
  const name: string | null = order?.shippingFullName || order?.customer?.name || null
  const phone: string | null = order?.shippingPhone || order?.customer?.phone || null
  const address = formatLocationAddress([
    order?.shippingAddressLine1,
    order?.shippingAddressLine2,
    order?.shippingCity,
    order?.shippingState,
    order?.shippingPostalCode,
    order?.shippingCountry,
  ])

  const legacyJson = order?.shippingAddress && typeof order.shippingAddress === "object"
    ? order.shippingAddress
    : null
  const coords =
    toValidCoordPair(order?.shippingLatitude, order?.shippingLongitude) ??
    toValidCoordPair(legacyJson?.latitude, legacyJson?.longitude)

  return {
    name,
    address,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    phone,
  }
}

function backfillOrderDropoffCoords(orderId: string, coords: CoordinatePair): void {
  prisma.order
    .update({
      where: { id: orderId },
      data: {
        shippingLatitude: coords.latitude,
        shippingLongitude: coords.longitude,
      },
    })
    .catch(() => null)
}

function backfillAssignmentPickupCoords(assignmentId: string, coords: CoordinatePair): void {
  prisma.riderDeliveryAssignment
    .update({
      where: { id: assignmentId },
      data: {
        sellerLatitude: coords.latitude,
        sellerLongitude: coords.longitude,
      },
    })
    .catch(() => null)
}

/**
 * Resolves pickupLocation & dropoffLocation for a single rider assignment,
 * optionally geocoding missing coordinates and persisting DB backfills asynchronously.
 */
export async function resolveAssignmentLocations(
  assignment: any,
  options: { geocodeIfMissing?: boolean; persistBackfill?: boolean } = {}
): Promise<{
  pickupLocation: OrderLocationPoint
  dropoffLocation: OrderLocationPoint
}> {
  const { geocodeIfMissing = true, persistBackfill = true } = options
  const seller = assignment?.seller || assignment?.order?.seller
  const pickupLocation = extractSellerPickupData(seller, assignment)
  const dropoffLocation = extractOrderDropoffData(assignment?.order)

  const pickupMissingInDb =
    assignment?.id &&
    !toValidCoordPair(assignment?.sellerLatitude, assignment?.sellerLongitude) &&
    pickupLocation.latitude != null &&
    pickupLocation.longitude != null

  if (pickupMissingInDb && persistBackfill) {
    backfillAssignmentPickupCoords(assignment.id, {
      latitude: pickupLocation.latitude!,
      longitude: pickupLocation.longitude!,
    })
  }

  const orderJson = assignment?.order?.shippingAddress
  const orderMissingColumn =
    assignment?.order?.id &&
    !toValidCoordPair(assignment?.order?.shippingLatitude, assignment?.order?.shippingLongitude) &&
    dropoffLocation.latitude != null &&
    dropoffLocation.longitude != null
  if (orderMissingColumn && persistBackfill && orderJson != null) {
    backfillOrderDropoffCoords(assignment.order.id, {
      latitude: dropoffLocation.latitude!,
      longitude: dropoffLocation.longitude!,
    })
  }

  if (geocodeIfMissing) {
    const tasks: Promise<void>[] = []

    if (pickupLocation.latitude == null && pickupLocation.address) {
      tasks.push(
        geocodeAddressServer(pickupLocation.address).then((coords) => {
          if (!coords) return
          pickupLocation.latitude = coords.latitude
          pickupLocation.longitude = coords.longitude
          if (persistBackfill && assignment?.id) {
            backfillAssignmentPickupCoords(assignment.id, coords)
          }
        })
      )
    }

    if (dropoffLocation.latitude == null && dropoffLocation.address) {
      tasks.push(
        geocodeAddressServer(dropoffLocation.address).then((coords) => {
          if (!coords) return
          dropoffLocation.latitude = coords.latitude
          dropoffLocation.longitude = coords.longitude
          if (persistBackfill && assignment?.order?.id) {
            backfillOrderDropoffCoords(assignment.order.id, coords)
          }
        })
      )
    }

    if (tasks.length > 0) {
      await Promise.all(tasks)
    }
  }

  return { pickupLocation, dropoffLocation }
}

/**
 * Batch location resolution for assignment list endpoints, capping external geocoding
 * calls to avoid latency spikes on large histories.
 */
export async function resolveManyAssignmentLocations(
  assignments: any[],
  maxUncachedGeocodes: number = 3
): Promise<Array<{ pickupLocation: OrderLocationPoint; dropoffLocation: OrderLocationPoint }>> {
  let remainingGeocodeBudget = maxUncachedGeocodes
  const BATCH_SIZE = 4
  const results: Array<{ pickupLocation: OrderLocationPoint; dropoffLocation: OrderLocationPoint }> = new Array(
    assignments.length
  )

  for (let i = 0; i < assignments.length; i += BATCH_SIZE) {
    const chunk = assignments.slice(i, i + BATCH_SIZE)
    const chunkResults = await Promise.all(
      chunk.map(async (assignment) => {
        const quickPickup = extractSellerPickupData(assignment?.seller || assignment?.order?.seller, assignment)
        const quickDropoff = extractOrderDropoffData(assignment?.order)
        const needsGeocode = quickPickup.latitude == null || quickDropoff.latitude == null
        const allowGeocode = needsGeocode && remainingGeocodeBudget > 0
        if (allowGeocode) {
          remainingGeocodeBudget -= 1
        }
        return resolveAssignmentLocations(assignment, {
          geocodeIfMissing: allowGeocode,
          persistBackfill: true,
        })
      })
    )
    for (let j = 0; j < chunkResults.length; j++) {
      results[i + j] = chunkResults[j]
    }
  }

  return results
}

/**
 * Resolves dropoff coordinates for an order detail response (Customer, Seller, Admin),
 * preferring persisted coordinates and lazily backfilling via server geocoding if absent.
 */
export async function resolveOrderDropoffPoint(
  order: any,
  options: { geocodeIfMissing?: boolean; persistBackfill?: boolean } = {}
): Promise<OrderLocationPoint> {
  const { geocodeIfMissing = true, persistBackfill = true } = options
  const dropoff = extractOrderDropoffData(order)

  const orderMissingColumn =
    order?.id &&
    !toValidCoordPair(order?.shippingLatitude, order?.shippingLongitude) &&
    dropoff.latitude != null &&
    dropoff.longitude != null

  if (orderMissingColumn && persistBackfill) {
    backfillOrderDropoffCoords(order.id, {
      latitude: dropoff.latitude!,
      longitude: dropoff.longitude!,
    })
  }

  if (dropoff.latitude == null && geocodeIfMissing && dropoff.address) {
    const coords = await geocodeAddressServer(dropoff.address)
    if (coords) {
      dropoff.latitude = coords.latitude
      dropoff.longitude = coords.longitude
      if (persistBackfill && order?.id) {
        backfillOrderDropoffCoords(order.id, coords)
      }
    }
  }

  return dropoff
}

/**
 * Resolves coordinates when creating or updating a saved customer address.
 * Preserves explicit coordinates when valid; geocodes address text if missing
 * or if the text address changed without supplying new coordinates.
 */
export async function resolveSavedAddressCoords(params: {
  explicitLat?: unknown
  explicitLng?: unknown
  existingLat?: number | null
  existingLng?: number | null
  addressChanged?: boolean
  addressParts: Array<string | null | undefined>
}): Promise<CoordinatePair | null> {
  const { explicitLat, explicitLng, existingLat, existingLng, addressChanged = false, addressParts } = params

  const explicitCoords = toValidCoordPair(explicitLat, explicitLng)
  if (explicitCoords) return explicitCoords

  const existingCoords = toValidCoordPair(existingLat, existingLng)
  if (!addressChanged && existingCoords) {
    return existingCoords
  }

  const address = formatLocationAddress(addressParts)
  if (!address) return existingCoords

  const geocoded = await geocodeAddressServer(address)
  if (geocoded) return geocoded

  return addressChanged ? null : existingCoords
}

function extractStringValue(val: unknown): string | null | undefined {
  if (val === undefined) return undefined
  if (val === null) return null
  if (typeof val === "string") return val
  if (typeof val === "object" && "set" in (val as Record<string, unknown>)) {
    const inner = (val as { set?: unknown }).set
    return typeof inner === "string" || inner === null ? inner : undefined
  }
  return undefined
}

/**
 * Resolves coordinates for SellerBusinessInfo updates using explicit input,
 * existing businessInfo/store coordinates fallback, or geocoding the business address.
 */
export async function resolveSellerBusinessCoords(
  input: Record<string, unknown>,
  seller?: { businessInfo?: any; store?: any } | null
): Promise<CoordinatePair | null> {
  const existingBiz = seller?.businessInfo
  const streetIn = extractStringValue(input.street)
  const cityIn = extractStringValue(input.city)
  const districtIn = extractStringValue(input.district)
  const postalIn = extractStringValue(input.postalCode)

  const mergedStreet = streetIn !== undefined ? streetIn : existingBiz?.street
  const mergedCity = cityIn !== undefined ? cityIn : existingBiz?.city
  const mergedDistrict = districtIn !== undefined ? districtIn : existingBiz?.district
  const mergedPostal = postalIn !== undefined ? postalIn : existingBiz?.postalCode

  const addressChanged =
    (streetIn !== undefined && streetIn !== existingBiz?.street) ||
    (cityIn !== undefined && cityIn !== existingBiz?.city) ||
    (districtIn !== undefined && districtIn !== existingBiz?.district) ||
    (postalIn !== undefined && postalIn !== existingBiz?.postalCode)

  return resolveSavedAddressCoords({
    explicitLat: input.latitude,
    explicitLng: input.longitude,
    existingLat: existingBiz?.latitude ?? seller?.store?.lat,
    existingLng: existingBiz?.longitude ?? seller?.store?.lng,
    addressChanged,
    addressParts: [mergedStreet, mergedCity, mergedDistrict, mergedPostal],
  })
}

/**
 * Resolves coordinates for Seller Store updates using explicit input,
 * existing store/businessInfo coordinates fallback, or geocoding the store address.
 */
export async function resolveSellerStoreCoords(
  input: Record<string, unknown>,
  seller?: { store?: any; businessInfo?: any } | null
): Promise<CoordinatePair | null> {
  const existingStore = seller?.store
  const addressIn = extractStringValue(input.address)
  const cityIn = extractStringValue(input.city)
  const stateIn = extractStringValue(input.state)
  const zipIn = extractStringValue(input.zipCode)
  const countryIn = extractStringValue(input.country)

  const mergedAddress = addressIn !== undefined ? addressIn : existingStore?.address
  const mergedCity = cityIn !== undefined ? cityIn : existingStore?.city
  const mergedState = stateIn !== undefined ? stateIn : existingStore?.state
  const mergedZip = zipIn !== undefined ? zipIn : existingStore?.zipCode
  const mergedCountry = countryIn !== undefined ? countryIn : existingStore?.country

  const addressChanged =
    (addressIn !== undefined && addressIn !== existingStore?.address) ||
    (cityIn !== undefined && cityIn !== existingStore?.city) ||
    (stateIn !== undefined && stateIn !== existingStore?.state) ||
    (zipIn !== undefined && zipIn !== existingStore?.zipCode) ||
    (countryIn !== undefined && countryIn !== existingStore?.country)

  return resolveSavedAddressCoords({
    explicitLat: input.lat,
    explicitLng: input.lng,
    existingLat: existingStore?.lat ?? seller?.businessInfo?.latitude,
    existingLng: existingStore?.lng ?? seller?.businessInfo?.longitude,
    addressChanged,
    addressParts: [mergedAddress, mergedCity, mergedState, mergedZip, mergedCountry],
  })
}

/**
 * Resolves customer dropoff coordinates during checkout from the selected UserAddress.
 * Uses stored address coordinates directly, or geocodes once and backfills UserAddress.
 */
export async function resolveCheckoutOrderCoords(address: {
  id?: string
  latitude?: number | null
  longitude?: number | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
}): Promise<CoordinatePair | null> {
  const existing = toValidCoordPair(address?.latitude, address?.longitude)
  if (existing) return existing

  const fullAddress = formatLocationAddress([
    address?.addressLine1,
    address?.addressLine2,
    address?.city,
    address?.state,
    address?.postalCode,
    address?.country,
  ])
  if (!fullAddress) return null

  const geocoded = await geocodeAddressServer(fullAddress)
  if (geocoded && address?.id) {
    prisma.userAddress
      .update({
        where: { id: address.id },
        data: {
          latitude: geocoded.latitude,
          longitude: geocoded.longitude,
        },
      })
      .catch(() => null)
  }
  return geocoded
}

/**
 * Resolves seller pickup coordinates for dispatch, checking businessInfo -> store -> geocoding,
 * and lazily backfilling missing coordinates onto seller.store when store exists.
 */
export async function resolveDispatchSellerCoords(sellerInfo: any): Promise<CoordinatePair | null> {
  const fromBiz = toValidCoordPair(sellerInfo?.businessInfo?.latitude, sellerInfo?.businessInfo?.longitude)
  if (fromBiz) return fromBiz

  const fromStore = toValidCoordPair(sellerInfo?.store?.lat, sellerInfo?.store?.lng)
  if (fromStore) return fromStore

  const bizAddr = formatLocationAddress([
    sellerInfo?.businessInfo?.street,
    sellerInfo?.businessInfo?.city,
    sellerInfo?.businessInfo?.district,
    sellerInfo?.businessInfo?.postalCode,
  ])
  const storeAddr = formatLocationAddress([
    sellerInfo?.store?.address,
    sellerInfo?.store?.city,
    sellerInfo?.store?.state,
    sellerInfo?.store?.zipCode,
    sellerInfo?.store?.country,
  ])
  const fullAddress = bizAddr || storeAddr
  if (!fullAddress) return null

  const geocoded = await geocodeAddressServer(fullAddress)
  if (geocoded) {
    if (sellerInfo?.store?.id) {
      prisma.store
        .update({
          where: { id: sellerInfo.store.id },
          data: { lat: geocoded.latitude, lng: geocoded.longitude },
        })
        .catch(() => null)
    }
    if (sellerInfo?.businessInfo?.id) {
      prisma.sellerBusinessInfo
        .update({
          where: { id: sellerInfo.businessInfo.id },
          data: { latitude: geocoded.latitude, longitude: geocoded.longitude },
        })
        .catch(() => null)
    }
  }
  return geocoded
}

/**
 * Merges resolved pickupLocation & dropoffLocation into a rider assignment response
 * while preserving all existing backward-compatible fields.
 */
export function buildEnrichedAssignmentPayload<T extends Record<string, any>>(
  assignment: T,
  resolved: {
    pickupLocation: OrderLocationPoint
    dropoffLocation: OrderLocationPoint
  }
) {
  const { pickupLocation, dropoffLocation } = resolved
  const resolvedSellerLat = pickupLocation.latitude ?? assignment.sellerLatitude ?? null
  const resolvedSellerLng = pickupLocation.longitude ?? assignment.sellerLongitude ?? null

  const baseSeller = assignment.seller || assignment.order?.seller || null
  const enrichedSeller = baseSeller
    ? {
        ...baseSeller,
        store: baseSeller.store
          ? {
              ...baseSeller.store,
              lat: baseSeller.store.lat ?? resolvedSellerLat,
              lng: baseSeller.store.lng ?? resolvedSellerLng,
            }
          : baseSeller.store,
        businessInfo: baseSeller.businessInfo
          ? {
              ...baseSeller.businessInfo,
              latitude: baseSeller.businessInfo.latitude ?? resolvedSellerLat,
              longitude: baseSeller.businessInfo.longitude ?? resolvedSellerLng,
            }
          : baseSeller.businessInfo,
      }
    : null

  return {
    ...assignment,
    sellerLatitude: resolvedSellerLat,
    sellerLongitude: resolvedSellerLng,
    dropoffLatitude: dropoffLocation.latitude,
    dropoffLongitude: dropoffLocation.longitude,
    pickupLocation,
    dropoffLocation,
    ...(assignment.seller !== undefined ? { seller: enrichedSeller } : {}),
    ...(assignment.order !== undefined
      ? {
          order: assignment.order
            ? {
                ...assignment.order,
                shippingLatitude: dropoffLocation.latitude,
                shippingLongitude: dropoffLocation.longitude,
                dropoffLatitude: dropoffLocation.latitude,
                dropoffLongitude: dropoffLocation.longitude,
                seller: enrichedSeller,
              }
            : null,
        }
      : {}),
  }
}

/**
 * Resolves the rider's active assignment orderId if not explicitly supplied and
 * forwards live location/online state notifications to the Socket.IO internal bridge.
 */
export async function syncRiderLocationToSocket(params: {
  riderId: string
  orderId?: string | null
  latitude?: unknown
  longitude?: unknown
  heading?: unknown
  speed?: unknown
  isOnline?: boolean
}): Promise<void> {
  const { riderId, orderId, latitude, longitude, heading, speed, isOnline } = params
  if (!riderId) return

  const socketServerUrl =
    process.env.SOCKET_SERVER_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    "https://socket.meeemsl.com"

  if (isOnline === false) {
    fetch(`${socketServerUrl}/internal/rider-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ riderId, isOnline: false }),
    }).catch(() => {})
    return
  }

  const coords = toValidCoordPair(latitude, longitude)
  if (!coords) return

  let resolvedOrderId: string | null =
    typeof orderId === "string" && orderId.trim() ? orderId.trim() : null

  if (!resolvedOrderId) {
    const activeAssignment = await prisma.riderDeliveryAssignment
      .findFirst({
        where: {
          riderId,
          status: { in: ["ACCEPTED", "AT_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY"] },
        },
        select: { orderId: true },
        orderBy: { offeredAt: "desc" },
      })
      .catch(() => null)
    resolvedOrderId = activeAssignment?.orderId || null
  }

  const socketPayload = {
    riderId,
    orderId: resolvedOrderId,
    latitude: coords.latitude,
    longitude: coords.longitude,
    heading: heading != null && Number.isFinite(Number(heading)) ? Number(heading) : 0,
    speed: speed != null && Number.isFinite(Number(speed)) ? Number(speed) : 0,
  }

  fetch(`${socketServerUrl}/internal/location`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(socketPayload),
  }).catch(() => {})
}

/**
 * Broadcasts rider online/offline status changes to the Socket.IO internal bridge.
 */
export async function syncRiderStatusToSocket(params: {
  riderId: string
  isOnline: boolean
  latitude?: number | null
  longitude?: number | null
}): Promise<void> {
  const { riderId, isOnline, latitude, longitude } = params
  if (!riderId) return

  const socketServerUrl =
    process.env.SOCKET_SERVER_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    "https://socket.meeemsl.com"

  fetch(`${socketServerUrl}/internal/rider-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      riderId,
      isOnline: Boolean(isOnline),
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      timestamp: Date.now(),
    }),
  }).catch(() => {})
}

/**
 * Sanitizes a rider snapshot inside assignment arrays, hiding live GPS telemetry
 * once delivered or before pickup (when restricted for customer view).
 */
export function sanitizeAssignmentRiderTelemetry<T extends Record<string, any>>(
  rider: T | null | undefined,
  hideLocation: boolean
) {
  if (!rider) return null
  return {
    ...rider,
    currentLatitude: hideLocation ? null : rider.currentLatitude,
    currentLongitude: hideLocation ? null : rider.currentLongitude,
    speed: hideLocation ? 0 : rider.speed,
    heading: hideLocation ? 0 : rider.heading,
    isOnline: Boolean(
      rider.isOnline &&
        rider.lastLocationUpdate &&
        Date.now() - new Date(rider.lastLocationUpdate).getTime() < 10 * 60 * 1000
    ),
  }
}

/**
 * Fetches an assignment with seller/order context and enriches it with pickupLocation,
 * dropoffLocation, and coordinate snapshots for post-action API responses.
 */
export async function resolveEnrichedAssignmentById(assignmentId: string) {
  const assignment = await prisma.riderDeliveryAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      seller: {
        include: {
          store: true,
          businessInfo: true,
          user: { select: { name: true, phone: true } },
        },
      },
      rider: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
              image: true,
            },
          },
        },
      },
      order: {
        include: {
          seller: {
            include: {
              store: true,
              businessInfo: true,
              user: { select: { name: true, phone: true } },
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              phoneCountryCode: true,
              image: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  images: true,
                },
              },
              productVariant: {
                select: {
                  id: true,
                  name: true,
                  weight: true,
                  height: true,
                  width: true,
                  depth: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!assignment) return null

  const filteredItems = (assignment.order?.items || []).filter(
    (item) => !assignment.sellerId || item.sellerId === assignment.sellerId
  )
  const itemsShippingSum = filteredItems.reduce(
    (sum, item) => sum + (Number(item.shippingAmount) || 0),
    0
  )
  const earningForThisDelivery =
    itemsShippingSum > 0 ? itemsShippingSum : Number(assignment.order?.shipping || 0)

  const resolved = await resolveAssignmentLocations(assignment, {
    geocodeIfMissing: true,
    persistBackfill: true,
  })
  const enriched = buildEnrichedAssignmentPayload(assignment, resolved)

  return {
    ...enriched,
    earningForThisDelivery,
    deliveryFee: earningForThisDelivery,
    deliveryEarning: earningForThisDelivery,
    earning: earningForThisDelivery,
    order: enriched.order
      ? {
          ...enriched.order,
          items: filteredItems,
        }
      : null,
  }
}

/**
 * Builds the customer-facing activeDeliveryTracking snapshot respecting pre-pickup
 * Option B visibility (no live rider GPS or socket room until PICKED_UP / OUT_FOR_DELIVERY).
 */
export function buildCustomerDeliveryTracking(params: {
  assignment: any
  order: any
  dropoffPoint: OrderLocationPoint
  resolvedLoc?: { pickupLocation: OrderLocationPoint; dropoffLocation: OrderLocationPoint }
  fallbackStoreName?: string | null
}) {
  const { assignment, order, dropoffPoint, resolvedLoc, fallbackStoreName } = params
  if (!assignment) return null

  const r = assignment.rider
  const rUser = r?.user
  const pickupStoreName =
    resolvedLoc?.pickupLocation?.name ||
    assignment.seller?.store?.name ||
    fallbackStoreName ||
    order?.seller?.store?.name ||
    "Seller Store"

  const isAssignmentDelivered =
    assignment.status === "DELIVERED" ||
    order?.status === "DELIVERED" ||
    (Array.isArray(order?.items) &&
      order.items.length > 0 &&
      order.items.every((i: any) => i.itemStatus === "DELIVERED"))

  const isPickupDone =
    isAssignmentDelivered || ["PICKED_UP", "OUT_FOR_DELIVERY"].includes(assignment.status)
  const isLiveTrackingActive =
    !isAssignmentDelivered && ["PICKED_UP", "OUT_FOR_DELIVERY"].includes(assignment.status)
  const routePhase = isAssignmentDelivered
    ? "delivered"
    : isLiveTrackingActive
      ? "dropoff"
      : "awaiting_pickup"

  return {
    assignmentId: assignment.id,
    sellerId: assignment.sellerId,
    sellerStoreName: pickupStoreName,
    status: assignment.status,
    dispatchMode: assignment.dispatchMode,
    distanceKm: assignment.distanceKm,
    deliveryOtp: assignment.deliveryOtp,
    deliveryProofImage: assignment.deliveryProofImage,
    isDelivered: isAssignmentDelivered,
    isPickupDone,
    isLiveTrackingActive,
    routePhase,
    deliveryStatus: isAssignmentDelivered
      ? "DELIVERED"
      : isLiveTrackingActive
        ? "IN_TRANSIT"
        : assignment.status,
    deliveredAt: assignment.deliveredAt ? assignment.deliveredAt.toISOString() : null,
    rider: {
      id: r?.id,
      userId: r?.userId || null,
      name: rUser?.name || "Delivery Rider",
      email: rUser?.email || null,
      phone: rUser?.phone || null,
      phoneCountryCode: rUser?.phoneCountryCode || "+232",
      image: rUser?.image || r?.profileImage || null,
      vehicleName: r?.vehicleName || null,
      vehicleNumber: r?.vehicleNumber || null,
      drivingLicenseNo: r?.drivingLicenseNo || null,
      vehicleTypes: r?.vehicleTypes || [],
      isOnline: Boolean(
        r?.isOnline &&
          r?.lastLocationUpdate &&
          Date.now() - new Date(r.lastLocationUpdate).getTime() < 10 * 60 * 1000
      ),
    },
    currentLocation: isAssignmentDelivered
      ? {
          latitude: dropoffPoint.latitude,
          longitude: dropoffPoint.longitude,
          heading: 0,
          speed: 0,
          lastLocationUpdate: assignment.deliveredAt ? assignment.deliveredAt.toISOString() : null,
        }
      : isLiveTrackingActive
        ? {
            latitude: r?.currentLatitude || assignment.riderLatitudeAtOffer || null,
            longitude: r?.currentLongitude || assignment.riderLongitudeAtOffer || null,
            heading: r?.heading || 0,
            speed: r?.speed || 0,
            lastLocationUpdate: r?.lastLocationUpdate ? r.lastLocationUpdate.toISOString() : null,
          }
        : null,
    pickupLocation: resolvedLoc?.pickupLocation ?? {
      name: pickupStoreName,
      latitude: assignment.sellerLatitude || null,
      longitude: assignment.sellerLongitude || null,
    },
    destinationLocation: {
      fullName: order?.shippingFullName || null,
      phone: order?.shippingPhone || null,
      addressLine1: order?.shippingAddressLine1 || null,
      addressLine2: order?.shippingAddressLine2 || null,
      city: order?.shippingCity || null,
      state: order?.shippingState || null,
      postalCode: order?.shippingPostalCode || null,
      country: order?.shippingCountry || null,
      address: dropoffPoint.address,
      latitude: dropoffPoint.latitude,
      longitude: dropoffPoint.longitude,
    },
    socketRoom: isLiveTrackingActive ? `order:${order?.id}` : null,
  }
}

