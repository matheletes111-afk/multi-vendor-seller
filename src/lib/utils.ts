import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return "NLe " + new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date))
}

/** Format slot time range from ISO strings (UTC). Use for service order slot display. */
export function formatSlotTimeRange(isoStart: string, isoEnd: string): string {
  const s = new Date(isoStart)
  const e = new Date(isoEnd)
  const hh = (d: Date) => String(d.getUTCHours()).padStart(2, "0")
  const mm = (d: Date) => String(d.getUTCMinutes()).padStart(2, "0")
  return `${hh(s)}:${mm(s)} – ${hh(e)}:${mm(e)} UTC`
}

export function generateSlug(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
}

export function extractFoodImages(raw: unknown): string[] {
  if (!raw) return []

  if (Array.isArray(raw)) {
    const result: string[] = []
    for (const item of raw) {
      if (typeof item === "string" && item.trim()) {
        result.push(item.trim())
      } else if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>
        const url = obj.url || obj.src || obj.path || obj.image
        if (typeof url === "string" && url.trim()) {
          result.push(url.trim())
        }
      }
    }
    return result
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim()
    if (!trimmed) return []

    if (trimmed.startsWith("[") || trimmed.startsWith("{") || trimmed.startsWith('"')) {
      try {
        const parsed = JSON.parse(trimmed)
        return extractFoodImages(parsed)
      } catch {
        // Fall through
      }
    }

    if (trimmed.startsWith("http") || trimmed.startsWith("/") || trimmed.startsWith("data:") || trimmed.includes(".")) {
      return [trimmed]
    }
  }

  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>
    const url = obj.url || obj.src || obj.path || obj.image
    if (typeof url === "string" && url.trim()) {
      return [url.trim()]
    }
  }

  return []
}

/**
 * Pure, unbiased Fisher-Yates (Knuth) shuffle algorithm.
 * Returns a new shallow-copied array with elements permuted randomly.
 */
export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Seeded Fisher-Yates shuffle algorithm.
 * Given the same array and seed string, produces the exact same permutation.
 */
export function seededShuffle<T>(array: T[], seedStr: string): T[] {
  const arr = [...array]
  let seed = 0
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed * 31 + seedStr.charCodeAt(i)) & 0xffffffff
  }
  const random = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff
    return (seed >>> 0) / 4294967296
  }
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Formats a given timestamp into a dynamic human-friendly relative time string.
 * Examples: "Just now", "5m ago", "2h ago", "Yesterday", "3d ago", "2w ago", "1mo ago", "1y ago"
 */
export function formatTimeAgo(timestamp?: string | Date | number | null): string {
  if (!timestamp) return "Recently"
  const date = new Date(timestamp)
  if (isNaN(date.getTime())) return "Recently"

  const now = Date.now()
  const diffSec = Math.max(0, Math.floor((now - date.getTime()) / 1000))

  if (diffSec < 60) return "Just now"
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDays = Math.floor(diffHr / 24)
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays}d ago`
  const diffWeeks = Math.floor(diffDays / 7)
  if (diffWeeks < 4) return `${diffWeeks}w ago`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) return `${diffMonths}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}

/**
 * Marketplace Fair-Share Interleaving Algorithm (Flipkart / Amazon style).
 * 
 * Prevents dominant sellers (with 100+ items) from monopolizing the feed or burying small sellers.
 * Groups items by seller, randomly shuffles each seller's items, randomly shuffles the seller order,
 * and interleaves them round-robin:
 *   Round 1: [Seller A item 1, Seller B item 1, Seller C item 1, ...]
 *   Round 2: [Seller A item 2, Seller B item 2, Seller C item 2, ...]
 *   Round 3: ...
 * 
 * Result: Every approved seller gets immediate, equal exposure on every reload without seller clustering.
 */
export function fairMarketplaceInterleave<T>(
  items: T[],
  getSellerId: (item: T) => string | null | undefined,
  seed?: string | null
): T[] {
  if (!items || items.length <= 1) return items;

  // 1. Group items into buckets per seller
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const rawId = getSellerId(item);
    const sId = rawId && String(rawId).trim() ? String(rawId).trim() : "general_vendor";
    let list = buckets.get(sId);
    if (!list) {
      list = [];
      buckets.set(sId, list);
    }
    list.push(item);
  }

  // 2. Shuffle each seller's items internally so each reload varies products per seller
  for (const [sId, list] of buckets.entries()) {
    buckets.set(sId, seed ? seededShuffle(list, `${seed}_${sId}`) : shuffleArray(list));
  }

  // 3. Shuffle the order of sellers so a different seller is #1 on each reload
  const sellerIds = Array.from(buckets.keys());
  const shuffledSellerIds = seed ? seededShuffle(sellerIds, `${seed}_sellers`) : shuffleArray(sellerIds);

  // 4. Round-Robin Interleave across all sellers
  const result: T[] = [];
  let round = 0;
  let hasMore = true;

  while (hasMore) {
    hasMore = false;
    for (const sId of shuffledSellerIds) {
      const list = buckets.get(sId)!;
      if (round < list.length) {
        result.push(list[round]);
        hasMore = true;
      }
    }
    round++;
  }

  return result;
}

/**
 * Recursively parses multi-encoded JSON string arrays / CSV / raw string lists
 * (such as RestaurantSeller.primaryCuisine or serviceTypes) into a clean,
 * deduplicated array of display labels.
 */
export function parseCleanStringArray(raw: unknown, depth = 0): string[] {
  if (!raw || depth > 6) return [];

  const result: string[] = [];
  const seenLower = new Set<string>();

  const pushUnique = (val: string) => {
    const cleaned = val
      .replace(/\\"/g, '"')
      .replace(/^[\s\[\]"']+|[\s\[\]"']+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    if (!seenLower.has(key)) {
      seenLower.add(key);
      result.push(cleaned);
    }
  };

  if (Array.isArray(raw)) {
    for (const item of raw) {
      for (const parsed of parseCleanStringArray(item, depth + 1)) {
        pushUnique(parsed);
      }
    }
    return result;
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];

    // Try JSON parsing whenever the string looks like a JSON array, object, or quoted JSON string
    if (
      trimmed.startsWith("[") ||
      trimmed.startsWith("{") ||
      trimmed.startsWith('"') ||
      trimmed.startsWith('"[') ||
      trimmed.includes('\\"')
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed !== raw) {
          for (const item of parseCleanStringArray(parsed, depth + 1)) {
            pushUnique(item);
          }
          return result;
        }
      } catch {
        // Handle partially valid or double-escaped bracketed arrays like '["American","African"'
        const stripped = trimmed.replace(/^[\[\s]+|[\]\s]+$/g, "");
        if (stripped.includes('","') || stripped.includes('", "') || stripped.includes(",")) {
          const parts = stripped.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
          for (const part of parts) {
            pushUnique(part);
          }
          return result;
        }
      }
    }

    pushUnique(trimmed);
    if (trimmed.includes(",")) {
      const csvResult: string[] = [];
      const csvSeen = new Set<string>();
      for (const part of trimmed.split(",")) {
        const cleaned = part
          .replace(/^[\s\[\]"']+|[\s\[\]"']+$/g, "")
          .replace(/\s+/g, " ")
          .trim();
        if (!cleaned) continue;
        const key = cleaned.toLowerCase();
        if (!csvSeen.has(key)) {
          csvSeen.add(key);
          csvResult.push(cleaned);
        }
      }
      return csvResult;
    }
    return result;
  }

  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const val = obj.name ?? obj.label ?? obj.value ?? obj.title;
    if (typeof val === "string") {
      pushUnique(val);
    }
  }

  return result;
}

const KNOWN_UPPERCASE_WORDS = new Set(["SL", "UK", "USA", "US", "UAE", "CBD", "GRA", "PO", "ST", "NW", "NE", "SW", "SE"]);
const LOWERCASE_CONNECTORS = new Set(["of", "in", "at", "on", "by", "to", "and", "the"]);

function unwrapLocationValue(value: unknown, depth = 0): string {
  if (value === null || value === undefined || depth > 5) return "";
  if (Array.isArray(value)) {
    return parseCleanStringArray(value).join(", ");
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const picked = obj.city ?? obj.street ?? obj.name ?? obj.label ?? obj.address ?? "";
    return picked ? unwrapLocationValue(picked, depth + 1) : "";
  }
  const str = String(value).trim();
  if (!str) return "";
  if (
    str.startsWith("[") ||
    str.startsWith("{") ||
    (str.startsWith('"') && str.endsWith('"'))
  ) {
    try {
      const parsed = JSON.parse(str);
      if (parsed !== value) {
        return unwrapLocationValue(parsed, depth + 1);
      }
    } catch {
      if (str.startsWith("[")) {
        return parseCleanStringArray(str).join(", ");
      }
    }
  }
  return str;
}

/**
 * Formats a single address/location part (city, street, state, landmark),
 * unwrapping accidental JSON encoding, normalizing spacing/punctuation, and
 * converting all-lowercase, all-uppercase, or lowercase words in mixed-case
 * values to readable Title Case.
 */
export function formatLocationPart(value: unknown): string {
  const raw = unwrapLocationValue(value);
  if (!raw) return "";

  const trimmed = raw
    .replace(/\\"/g, "")
    .replace(/^[\s"'`\[\],]+|[\s"'`\[\],]+$/g, "")
    .replace(/\s*,\s*/g, ", ")
    .replace(/,\s*,+/g, ", ")
    .replace(/\s+/g, " ")
    .trim();

  if (!trimmed) return "";

  const isAllUpper = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);

  return trimmed
    .split(" ")
    .map((word, idx) => {
      const cleanAlpha = word.replace(/[^a-zA-Z]/g, "");
      if (!cleanAlpha) return word;
      if (isAllUpper) {
        if (KNOWN_UPPERCASE_WORDS.has(cleanAlpha.toUpperCase())) {
          return word;
        }
        return word.replace(/[a-zA-Z]+/, (alpha) =>
          alpha.charAt(0).toUpperCase() + alpha.slice(1).toLowerCase()
        );
      }
      // Capitalize purely lowercase words (while leaving intentional mixed-case brand/street tokens intact)
      const hasUpper = /[A-Z]/.test(cleanAlpha);
      if (!hasUpper) {
        if (idx > 0 && LOWERCASE_CONNECTORS.has(cleanAlpha.toLowerCase())) {
          return word;
        }
        return word.replace(/[a-z]+/, (alpha) =>
          alpha.charAt(0).toUpperCase() + alpha.slice(1)
        );
      }
      return word;
    })
    .join(" ");
}

/**
 * Combines street, city, state, and landmark into a clean, deduplicated location label.
 */
export function formatRestaurantLocation(loc: {
  street?: unknown;
  city?: unknown;
  state?: unknown;
  landmark?: unknown;
  compact?: boolean;
  fallback?: string;
}): string {
  const street = formatLocationPart(loc.street);
  const city = formatLocationPart(loc.city);
  const state = formatLocationPart(loc.state);
  const landmark = formatLocationPart(loc.landmark);

  if (loc.compact) {
    if (city && street && !street.toLowerCase().includes(city.toLowerCase())) {
      const combined = `${street}, ${city}`;
      return combined.length <= 28 ? combined : city;
    }
    return city || street || state || landmark || (loc.fallback ?? "Local");
  }

  const parts: string[] = [];
  const addPart = (part: string) => {
    if (!part) return;
    const lowerPart = part.toLowerCase();
    const alreadyCovered = parts.some((existing) => {
      const lowerExisting = existing.toLowerCase();
      return lowerExisting === lowerPart || lowerExisting.includes(lowerPart);
    });
    if (!alreadyCovered) {
      parts.push(part);
    }
  };

  addPart(landmark);
  addPart(street);
  addPart(city);
  addPart(state);

  return parts.join(", ") || (loc.fallback ?? "");
}

