/**
 * Restaurant seller bulk food items import parser & template generator.
 * Supports CSV and XLSX formats with selling price / discount computation and image URL lists.
 */

import * as XLSX from "xlsx"

export const BULK_FOOD_TEMPLATE_FILENAME_CSV = "restaurant-food-bulk-template.csv"
export const BULK_FOOD_TEMPLATE_FILENAME_XLSX = "restaurant-food-bulk-template.xlsx"
export const BULK_FOOD_SHEET_NAME = "FoodMenu"

export const BULK_FOOD_COLUMN_KEYS = [
  "category",
  "food_name",
  "price",
  "discount",
  "is_veg",
  "description",
  "food_images",
  "is_active",
] as const

export type BulkFoodColumnKey = (typeof BULK_FOOD_COLUMN_KEYS)[number]

/** Header text written into templates. Internal key `discount` holds the SELLING price, so it is labelled clearly. */
export const BULK_FOOD_HEADER_LABELS: Record<BulkFoodColumnKey, string> = {
  category: "category",
  food_name: "food_name",
  price: "price",
  discount: "selling_price",
  is_veg: "is_veg",
  description: "description",
  food_images: "food_images",
  is_active: "is_active",
}

export const REQUIRED_FOOD_COLUMNS: BulkFoodColumnKey[] = ["food_name", "category", "price"]

const HEADER_ALIASES: Record<string, BulkFoodColumnKey> = {
  category: "category",
  category_name: "category",
  food_category: "category",
  cuisine: "category",

  food_name: "food_name",
  name: "food_name",
  dish_name: "food_name",
  item_name: "food_name",
  dish: "food_name",
  title: "food_name",

  price: "price",
  regular_price: "price",
  mrp: "price",
  actual_price: "price",
  base_price: "price",
  listed_price: "price",

  discount: "discount",
  selling_price: "discount",
  sellingprice: "discount",
  discounted_price: "discount",
  offer_price: "discount",
  final_price: "discount",

  is_veg: "is_veg",
  veg: "is_veg",
  isveg: "is_veg",
  vegetarian: "is_veg",
  food_type: "is_veg",

  description: "description",
  desc: "description",
  details: "description",
  ingredients: "description",

  food_images: "food_images",
  images: "food_images",
  image: "food_images",
  image_urls: "food_images",
  photos: "food_images",
  image_url: "food_images",

  is_active: "is_active",
  active: "is_active",
  status: "is_active",
  available: "is_active",
}

function normalizeHeader(h: string): string {
  const clean = h.trim().toLowerCase().replace(/[\s-]+/g, "_")
  return HEADER_ALIASES[clean] || clean
}

export type BulkFoodDataRow = {
  excelRow: number
  cells: Partial<Record<BulkFoodColumnKey, string>>
}

function escapeCsvField(s: string): string {
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/** RFC 4180-style CSV parse */
export function parseCsvGrid(content: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let i = 0
  let inQuotes = false
  const str = content.replace(/^\uFEFF/, "")
  if (!str.trim()) return []

  while (i < str.length) {
    const c = str[i]
    if (inQuotes) {
      if (c === '"') {
        if (str[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }

    if (c === '"') {
      inQuotes = true
      i++
      continue
    }

    if (c === ",") {
      row.push(field)
      field = ""
      i++
      continue
    }

    if (c === "\r") {
      i++
      continue
    }

    if (c === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
      i++
      continue
    }

    field += c
    i++
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

/** Parse XLSX or CSV buffer into structured data rows */
export function parseBulkFoodFile(
  buffer: Buffer,
  filename: string
): { ok: true; rows: BulkFoodDataRow[]; headers: string[] } | { ok: false; error: string } {
  let grid: string[][] = []
  const lowerName = filename.toLowerCase()

  if (lowerName.endsWith(".csv")) {
    const text = buffer.toString("utf8")
    grid = parseCsvGrid(text)
  } else {
    try {
      const wb = XLSX.read(buffer, { type: "buffer" })
      const sheetName = wb.SheetNames[0]
      if (!sheetName) {
        return { ok: false, error: "Workbook has no sheets" }
      }
      const sheet = wb.Sheets[sheetName]
      const raw = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" })
      grid = raw.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? "").trim()) : []))
    } catch (e: any) {
      return { ok: false, error: `Failed to parse Excel file: ${e.message || String(e)}` }
    }
  }

  // Find header row (must contain at least food_name or price or category)
  let headerRowIdx = -1
  let colIndexToKey = new Map<number, BulkFoodColumnKey>()

  for (let r = 0; r < Math.min(10, grid.length); r++) {
    const row = grid[r] || []
    const mapping = new Map<number, BulkFoodColumnKey>()

    row.forEach((cell, idx) => {
      const norm = normalizeHeader(String(cell || ""))
      if (BULK_FOOD_COLUMN_KEYS.includes(norm as BulkFoodColumnKey)) {
        mapping.set(idx, norm as BulkFoodColumnKey)
      }
    })

    const foundKeys = new Set(mapping.values())
    if (foundKeys.has("food_name") || (foundKeys.has("price") && foundKeys.has("category"))) {
      headerRowIdx = r
      colIndexToKey = mapping
      break
    }
  }

  if (headerRowIdx === -1) {
    return {
      ok: false,
      error: `Could not identify header row. Ensure columns include: ${REQUIRED_FOOD_COLUMNS.join(", ")}`,
    }
  }

  const detectedHeaders = Array.from(colIndexToKey.values())
  const missing = REQUIRED_FOOD_COLUMNS.filter((k) => !detectedHeaders.includes(k))
  if (missing.length > 0) {
    return {
      ok: false,
      error: `Missing required columns: ${missing.join(", ")}`,
    }
  }

  const rows: BulkFoodDataRow[] = []

  for (let r = headerRowIdx + 1; r < grid.length; r++) {
    const line = grid[r] || []
    if (!line.some((c) => String(c ?? "").trim() !== "")) {
      continue // Skip empty line
    }

    const cells: Partial<Record<BulkFoodColumnKey, string>> = {}
    colIndexToKey.forEach((key, colIdx) => {
      const v = line[colIdx]
      if (v !== undefined && v !== null) {
        cells[key] = String(v).trim()
      }
    })

    rows.push({
      excelRow: r + 1, // 1-based index matching spreadsheet line
      cells,
    })
  }

  return { ok: true, rows, headers: detectedHeaders }
}

/** Parses pipe (|) or newline delimited image URLs */
export function parseFoodImages(s?: string | null): string[] {
  if (!s || !s.trim()) return []
  return s
    .split(/[\n|]+/)
    .map((x) => x.trim())
    .filter(Boolean)
}

/** Parses number cleanly handling commas or currency symbols */
export function parseCleanNumber(val: string | number | undefined | null): number {
  if (val == null) return NaN
  const s = String(val).replace(/,/g, "").replace(/[^0-9.-]/g, "").trim()
  return s ? Number(s) : NaN
}

/** Parses boolean values */
export function parseBool(val?: string | null, defaultVal = true): boolean {
  if (!val || !val.trim()) return defaultVal
  const t = val.trim().toLowerCase()
  if (["y", "yes", "true", "1", "veg", "vegetarian", "pure veg"].includes(t)) return true
  if (["n", "no", "false", "0", "non-veg", "non veg", "nonveg"].includes(t)) return false
  return defaultVal
}

/** Generate realistic example dishes based on seller cuisines/categories */
export function exampleFoodDataRows(cuisines: string[]): string[][] {
  const baseCuisines = cuisines.length > 0 ? cuisines.slice(0, 5) : ["Mains", "Starters", "Desserts"]

  const sampleLibrary: Record<string, { name: string; price: string; discount: string; isVeg: string; desc: string; img: string }> = {
    Mains: {
      name: "Paneer Butter Masala",
      price: "280",
      discount: "240",
      isVeg: "Yes",
      desc: "Rich cottage cheese cubes simmered in a silky tomato, cashew and butter gravy.",
      img: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&q=80",
    },
    Starters: {
      name: "Crispy Chilli Paneer",
      price: "220",
      discount: "190",
      isVeg: "Yes",
      desc: "Wok-tossed paneer cubes in spicy soy-garlic sauce with bell peppers.",
      img: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&q=80",
    },
    Biryani: {
      name: "Special Dum Chicken Biryani",
      price: "320",
      discount: "280",
      isVeg: "No",
      desc: "Aromatic basmati rice cooked with succulent chicken, saffron, and house whole spices.",
      img: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=600&q=80",
    },
    Pizza: {
      name: "Farmhouse Veggie Supreme Pizza",
      price: "399",
      discount: "349",
      isVeg: "Yes",
      desc: "Fresh hand-tossed dough topped with mozzarella, mushrooms, capsicum, olives & onions.",
      img: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80",
    },
    Desserts: {
      name: "Gulab Jamun with Rabri",
      price: "120",
      discount: "99",
      isVeg: "Yes",
      desc: "Golden warm dumplings served with fragrant cardamom-infused condensed milk rabri.",
      img: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&q=80",
    },
    Beverages: {
      name: "Fresh Mango Mint Cooler",
      price: "110",
      discount: "90",
      isVeg: "Yes",
      desc: "Refreshing alphonso mango nectar shaken with crushed mint leaves and sparkling soda.",
      img: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&q=80",
    },
    Chinese: {
      name: "Hakka Vegetable Noodles",
      price: "190",
      discount: "160",
      isVeg: "Yes",
      desc: "Street style wok-tossed noodles with shredded cabbage, carrots, scallions, and light soy.",
      img: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600&q=80",
    },
  }

  return baseCuisines.map((cat, idx) => {
    const preset = sampleLibrary[cat] || {
      name: `${cat} Special Dish`,
      price: "200",
      discount: "170",
      isVeg: idx % 2 === 0 ? "Yes" : "No",
      desc: `Chef's signature preparation for ${cat} using fresh local farm ingredients and secret spices.`,
      img: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",
    }

    return [
      cat,                  // category
      preset.name,          // food_name
      preset.price,         // price (MRP / Regular price)
      preset.discount,      // discount (Final selling price customer pays)
      preset.isVeg,         // is_veg
      preset.desc,          // description
      preset.img,           // food_images
      "Yes",                // is_active
    ]
  })
}

/** Build CSV template */
export function buildRestaurantTemplateCsv(cuisines: string[], dummy: boolean): Buffer {
  const headers = BULK_FOOD_COLUMN_KEYS.map((k) => BULK_FOOD_HEADER_LABELS[k])
  const headerLine = headers.map(escapeCsvField).join(",")
  const rows = dummy ? exampleFoodDataRows(cuisines).map((r) => r.map(escapeCsvField).join(",")) : []
  const bom = "\uFEFF"
  const body = `${bom}${headerLine}\r\n${rows.join("\r\n")}${rows.length ? "\r\n" : ""}`
  return Buffer.from(body, "utf8")
}

/** Build XLSX template with detailed instruction sheet */
export function buildRestaurantTemplateXlsx(cuisines: string[], dummy: boolean): Buffer {
  const headers = BULK_FOOD_COLUMN_KEYS.map((k) => BULK_FOOD_HEADER_LABELS[k])
  const wb = XLSX.utils.book_new()
  const data = dummy ? exampleFoodDataRows(cuisines) : []
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
  XLSX.utils.book_append_sheet(wb, ws, BULK_FOOD_SHEET_NAME)

  const instructions: string[][] = [
    ["RESTAURANT FOOD BULK IMPORT - GUIDE & COLUMN SPECIFICATIONS"],
    [""],
    ["HOW SELLING PRICE & DISCOUNT WORK:"],
    ["• 'price' = Regular / Listed MRP price of the dish (e.g. 200)."],
    ["• 'selling_price' = The FINAL price the customer pays (e.g. 160). Do NOT enter the discount amount."],
    ["• The system automatically computes and stores the discount amount in the database (200 - 160 = 40)."],
    ["• On the customer menu, it will display 160 with 200 struck-through and a discount badge."],
    ["• If there is no discount, leave 'selling_price' blank or enter the same value as 'price'."],
    ["• RULE: 'selling_price' must be greater than 0 and CANNOT be greater than 'price'."],
    [""],
    ["HOW FOOD IMAGES WORK:"],
    ["• First go to 'Bulk Image Upload' in your Restaurant Dashboard and upload your dish photos."],
    ["• Click 'Copy Selected URLs' to copy the image links."],
    ["• Paste the URL(s) into the 'food_images' column. To include multiple photos for one dish, separate them with a vertical bar (|)."],
    [""],
    ["=========================================================================================="],
    ["COLUMN SPECIFICATIONS TABLE"],
    ["=========================================================================================="],
    ["Column Header", "Required?", "Description & Format", "Example Input"],
    ["category", "YES", "Dish category / cuisine name. e.g. Starters, Mains, Biryani, Desserts", "Mains"],
    ["food_name", "YES", "Name of the dish as shown on your menu", "Paneer Butter Masala"],
    ["price", "YES", "Regular Listed Price / MRP (number)", "280"],
    ["selling_price", "NO", "Final price customer pays (number > 0 and <= price). Leave blank if no discount", "240"],
    ["is_veg", "NO", "Enter 'Yes' for Vegetarian, 'No' for Non-Vegetarian (defaults to Yes)", "Yes"],
    ["description", "NO", "Dish details, preparation notes, allergens, or ingredients", "Rich cottage cheese in tomato cashew gravy"],
    ["food_images", "NO", "One or more public image URLs separated by vertical bar (|)", "https://.../img1.webp | https://.../img2.webp"],
    ["is_active", "NO", "Enter 'Yes' to make active immediately or 'No' to save as draft (defaults to Yes)", "Yes"],
  ]

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions)
  XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions")

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
}
