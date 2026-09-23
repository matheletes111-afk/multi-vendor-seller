/** Bulk product import: CSV + XLSX, multi-category via category_id column. */

import * as XLSX from "xlsx"

export const BULK_TEMPLATE_FILENAME_CSV = "product-bulk-template.csv"
export const BULK_TEMPLATE_FILENAME_XLSX = "product-bulk-template.xlsx"
export const BULK_SHEET_NAME = "Products"

/**
 * Column order. category_id = which marketplace category this product belongs to (same for all rows in a product_key group).
 */
export const BULK_COLUMN_KEYS = [
  "category",
  "product_name",
  "brand",
  "product_description",
  "condition",
  "delivery_charge_per_km",
  "variant_name",
  "price",
  "discount",
  "gst_applicable",
  "stock",
  "sku_code",
  "weight",
  "height",
  "width",
  "depth",
  "product_variant_images",
  "variant_details",
  "specifications",
  "additional_details",
  "return_policy",
  "return_limit_days",
  "replacement_allowed",
  "delivery_days",
] as const

export type BulkColumnKey = (typeof BULK_COLUMN_KEYS)[number]

export const REQUIRED_VARIANT_COLUMNS: BulkColumnKey[] = ["variant_name", "price", "stock"]

const KEY_SET = new Set<string>(BULK_COLUMN_KEYS)

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_")
}

export type BulkDataRow = {
  excelRow: number
  cells: Partial<Record<BulkColumnKey, string>>
}

function escapeCsvField(s: string): string {
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/** RFC 4180-style CSV parse (handles quoted fields). */
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
  row.push(field)
  if (row.some((cell) => cell.trim() !== "")) {
    rows.push(row)
  }
  return rows
}

function mapGridToRows(aoa: unknown[][], sheetErrors: string[]): { rows: BulkDataRow[]; sheetErrors: string[] } {
  if (!aoa.length) {
    return { rows: [], sheetErrors: [...sheetErrors, "Sheet is empty."] }
  }

  const headerRow = (aoa[0] ?? []).map((c) => normalizeHeader(String(c ?? "")))
  const colIndexToKey = new Map<number, BulkColumnKey>()
  headerRow.forEach((h, idx) => {
    let key = h === "variant_images" ? "product_variant_images" : h
    if (key === "selling_price" || key === "discounted_price" || key === "discount_price") {
      key = "discount"
    }
    if (KEY_SET.has(key)) {
      colIndexToKey.set(idx, key as BulkColumnKey)
    }
  })

  if (!colIndexToKey.size) {
    return {
      rows: [],
      sheetErrors: [
        ...sheetErrors,
        "No recognized headers. Use the downloaded template (row 1 must list columns such as category, product_name, variant_name, price, stock).",
      ],
    }
  }

  const present = new Set(colIndexToKey.values())
  const missingCols: string[] = []
  for (const req of REQUIRED_VARIANT_COLUMNS) {
    if (!present.has(req)) {
      missingCols.push(`Missing required column for variants: "${req}".`)
    }
  }
  if (!present.has("category")) {
    missingCols.push(`Missing required column: "category" (use one of the available categories).`)
  }
  if (missingCols.length > 0) {
    return { rows: [], sheetErrors: [...sheetErrors, ...missingCols] }
  }

  const rows: BulkDataRow[] = []
  for (let i = 1; i < aoa.length; i++) {
    const line = (aoa[i] ?? []) as unknown[]
    const cells: Partial<Record<BulkColumnKey, string>> = {}
    let any = false
    for (const [colIdx, key] of colIndexToKey) {
      const raw = line[colIdx]
      const s = raw == null ? "" : String(raw).trim()
      if (s) any = true
      cells[key] = s
    }
    if (!any) continue
    rows.push({ excelRow: i + 1, cells })
  }

  return { rows, sheetErrors }
}

export function parseBulkFromCsvBuffer(buffer: Buffer): { rows: BulkDataRow[]; sheetErrors: string[] } {
  let text: string
  try {
    text = buffer.toString("utf8")
  } catch {
    return { rows: [], sheetErrors: ["Could not read file as UTF-8."] }
  }
  const aoa = parseCsvGrid(text)
  if (!aoa.length) {
    return { rows: [], sheetErrors: ["File is empty."] }
  }
  return mapGridToRows(aoa, [])
}

export function parseBulkFromXlsxBuffer(buffer: Buffer): { rows: BulkDataRow[]; sheetErrors: string[] } {
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: false })
  } catch {
    return { rows: [], sheetErrors: ["Could not read Excel file. Use a valid .xlsx file."] }
  }

  const sheetName = workbook.SheetNames.includes(BULK_SHEET_NAME) ? BULK_SHEET_NAME : workbook.SheetNames[0]
  if (!sheetName) {
    return { rows: [], sheetErrors: ["Workbook has no sheets."] }
  }
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    return { rows: [], sheetErrors: [`Sheet "${sheetName}" is missing.`] }
  }

  const aoa = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][]

  return mapGridToRows(aoa, [])
}

export function parseBulkFile(buffer: Buffer, fileName: string): { rows: BulkDataRow[]; sheetErrors: string[] } {
  const lower = fileName.toLowerCase()
  if (lower.endsWith(".xlsx")) return parseBulkFromXlsxBuffer(buffer)
  if (lower.endsWith(".csv")) return parseBulkFromCsvBuffer(buffer)
  return { rows: [], sheetErrors: ["Upload a .csv or .xlsx file."] }
}

/** Parses variant attributes from either key:value pairs (e.g. "color:black, size:regular") or JSON format. */
export function parseVariantAttributes(
  s: string | undefined | null,
  excelRow: number
): { ok: true; attrs: Record<string, string> } | { ok: false; error: string } {
  if (!s || !s.trim()) return { ok: true, attrs: {} }
  const trimmed = s.trim()

  // 1. JSON format if it starts with '{' and ends with '}'
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const o = JSON.parse(trimmed) as unknown
      if (!o || typeof o !== "object" || Array.isArray(o)) {
        return { ok: false, error: `Row ${excelRow}: variant_details JSON must be an object` }
      }
      const attrs: Record<string, string> = {}
      for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
        if (k && k.trim()) {
          attrs[k.trim()] = v == null ? "" : String(v).trim()
        }
      }
      return { ok: true, attrs }
    } catch {
      // Fall through to plain text parsing
    }
  }

  // 2. Parse key:value or key=value pairs (e.g. "color:black, size:regular" or "color: Gold | size: Premium")
  try {
    const attrs: Record<string, string> = {}
    const pairs = trimmed.split(/[,;\n|]+/)
    for (const pair of pairs) {
      const p = pair.trim()
      if (!p) continue
      const colonIdx = p.indexOf(":")
      const equalIdx = p.indexOf("=")

      if (colonIdx !== -1) {
        const k = p.slice(0, colonIdx).trim().replace(/^["'{}]|["'{}]/g, "").trim()
        const v = p.slice(colonIdx + 1).trim().replace(/^["'{}]|["'{}]/g, "").trim()
        if (k) attrs[k] = v
      } else if (equalIdx !== -1) {
        const k = p.slice(0, equalIdx).trim().replace(/^["'{}]|["'{}]/g, "").trim()
        const v = p.slice(equalIdx + 1).trim().replace(/^["'{}]|["'{}]/g, "").trim()
        if (k) attrs[k] = v
      } else {
        const cleanTag = p.replace(/^["'{}]|["'{}]/g, "").trim()
        if (cleanTag) attrs[cleanTag] = cleanTag
      }
    }
    return { ok: true, attrs }
  } catch (err: any) {
    return {
      ok: false,
      error: `Row ${excelRow}: failed to parse variant_details. Use "color: Black, size: Regular" or JSON.`,
    }
  }
}

/**
 * Returns dummy data rows based on selected categories.
 * One example product per category (up to 3 categories).
 */
export function exampleDataRows(categories: string[]): string[][] {
  const finalCategories = categories.length > 0 ? categories.slice(0, 3) : ["Example Category"]

  return finalCategories.flatMap((catName, idx) => {
    const prodName = `${catName} Example Product`
    
    // We can generate 2 variants for each product to show how variant grouping works!
    return [
      [
        catName,              // category
        prodName,             // product_name
        "ExampleBrand",       // brand
        "This is an example product description. Replace or delete before import.", // product_description
        "NEW",                // condition
        "0",                  // delivery_charge_per_km
        "Standard Version",   // variant_name
        "100",                // price (Price = 100)
        "80",                 // discount (Enter final price to sell: 80 -> customer pays 80)
        "Yes",                // gst_applicable
        "100",                // stock
        `SKU-${idx + 1}-STD`, // sku_code
        "0.5",                // weight (kg)
        "10",                 // height (cm)
        "10",                 // width (cm)
        "10",                 // depth (cm)
        "https://example.com/variant-std.jpg", // product_variant_images
        "color: Black, size: Regular", // variant_details
        "Standard specification", // specifications
        "Standard details",   // additional_details
        "Returnable",         // return_policy
        "7",                  // return_limit_days
        "Yes",                // replacement_allowed
        "7",                  // delivery_days
      ],
      [
        catName,              // category
        prodName,             // product_name
        "ExampleBrand",       // brand
        "This is an example product description. Replace or delete before import.", // product_description
        "NEW",                // condition
        "0",                  // delivery_charge_per_km
        "Premium Version",    // variant_name
        "200",                // price (Price = 200)
        "160",                // discount (Enter final price to sell: 160 -> customer pays 160)
        "Yes",                // gst_applicable
        "50",                 // stock
        `SKU-${idx + 1}-PREM`,// sku_code
        "1.2",                // weight (kg)
        "15",                 // height (cm)
        "15",                 // width (cm)
        "15",                 // depth (cm)
        "https://example.com/variant-prem.jpg", // product_variant_images
        "color: Gold, size: Premium", // variant_details
        "Premium specification", // specifications
        "Premium details",    // additional_details
        "Returnable",         // return_policy
        "7",                  // return_limit_days
        "Yes",                // replacement_allowed
        "7",                  // delivery_days
      ]
    ]
  })
}

export function buildTemplateCsv(
  categories: string[],
  dummy: boolean
): Buffer {
  const headers = [...BULK_COLUMN_KEYS]
  const headerLine = headers.map(escapeCsvField).join(",")
  const rows = dummy ? exampleDataRows(categories).map((r) =>
    r.map(escapeCsvField).join(",")
  ) : []
  const bom = "\uFEFF"
  const body = `${bom}${headerLine}\r\n${rows.join("\r\n")}${rows.length ? "\r\n" : ""}`
  return Buffer.from(body, "utf8")
}

export function buildTemplateXlsx(
  categories: string[],
  dummy: boolean
): Buffer {
  const headers = [...BULK_COLUMN_KEYS]
  const wb = XLSX.utils.book_new()
  const data = dummy ? exampleDataRows(categories) : []
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
  XLSX.utils.book_append_sheet(wb, ws, BULK_SHEET_NAME)

  const instr: string[][] = [
    ["PRODUCT BULK IMPORT - COMPLETE FIELD INSTRUCTIONS & EXAMPLES"],
    [""],
    ["QUICK OVERVIEW:"],
    ["• Multi-Variant Grouping: Rows with the EXACT SAME 'product_name' and 'category' are automatically grouped as variants of ONE product."],
    ["• Simplified Variant Details: Use natural pairs like 'color: Black, size: Regular' (no JSON braces/quotes required)."],
    ["• Images: Separate multiple public image URLs with a vertical pipe (|) or newline."],
    ["• Selling Price: In 'price' enter the MRP. In 'discount', enter the final selling price customer pays (e.g. Price=100, Discount=80 -> customer pays 80)."],
    ["• Limits: Maximum 500 rows per file."],
    [""],
    ["=========================================================================================================================="],
    ["COLUMN-BY-COLUMN FIELD INSTRUCTION TABLE (ALL 24 COLUMNS)"],
    ["=========================================================================================================================="],
    ["Column #", "Column Header", "Required?", "What To Put (Field Description & Rules)", "Example Input"],
    ["1", "category", "YES", "Name of marketplace category. Must match one of your assigned categories or an active category.", "Clothing & Fashion"],
    ["2", "product_name", "YES", "Full product title. Rows with identical name are grouped as variants of 1 product listing.", "Men Slim Fit Cotton T-Shirt"],
    ["3", "brand", "NO", "Brand or manufacturer name. Leave blank if unbranded.", "Nike"],
    ["4", "product_description", "NO", "Full overview and description of the product.", "100% breathable organic combed cotton t-shirt."],
    ["5", "condition", "NO", "Condition of the item: NEW or USED (defaults to NEW).", "NEW"],
    ["6", "delivery_charge_per_km", "NO", "Custom delivery charge per kilometer. Enter 0 for standard delivery.", "0"],
    ["7", "variant_name", "YES", "Specific name of this variant (size, color, pack, or model).", "Black / L"],
    ["8", "price", "YES", "Original MRP / listed price before discount (positive number).", "100"],
    ["9", "discount", "NO", "Final discounted price customer pays (e.g. Price=100, Discount=80 -> Customer pays 80). Blank = full price.", "80"],
    ["10", "gst_applicable", "NO", "Is tax applicable? Enter Yes or No (defaults to Yes).", "Yes"],
    ["11", "stock", "YES", "Available stock quantity for this variant (whole number >= 0).", "50"],
    ["12", "sku_code", "NO", "Your internal SKU / barcode identifier for inventory tracking.", "TSHIRT-BLK-L"],
    ["13", "weight", "CONDITIONAL", "Weight in KG. Mandatory if category requires weight, otherwise estimated by AI.", "0.35"],
    ["14", "height", "NO", "Package height in CM (estimated by AI if omitted).", "5"],
    ["15", "width", "NO", "Package width in CM (estimated by AI if omitted).", "20"],
    ["16", "depth", "NO", "Package depth in CM (estimated by AI if omitted).", "30"],
    ["17", "product_variant_images", "NO", "Public image URLs separated by vertical bar (|) or newline.", "https://example.com/front.jpg | https://example.com/back.jpg"],
    ["18", "variant_details", "NO", "Attributes describing variant: color: Black, size: Regular (JSON also accepted).", "color: Black, size: Regular"],
    ["19", "specifications", "NO", "Technical bullet points or specifications.", "180 GSM, Pre-shrunk fabric, Machine wash cold"],
    ["20", "additional_details", "NO", "Care instructions, warranty, or additional seller notes.", "Wash cold with like colors, do not iron on print"],
    ["21", "return_policy", "NO", "Return policy: Returnable or Non-Returnable (defaults to Non-Returnable).", "Returnable"],
    ["22", "return_limit_days", "NO", "Return window in days if Returnable (e.g. 7 or 14).", "7"],
    ["23", "replacement_allowed", "NO", "Is product replacement allowed? Enter Yes or No (defaults to No).", "Yes"],
    ["24", "delivery_days", "NO", "Estimated delivery time in days (integer >= 1, defaults to 7).", "5"],
    [""],
    ["NOTE: Please replace or delete the example dummy rows in the 'Products' tab before importing your real catalog."]
  ]
  const ws2 = XLSX.utils.aoa_to_sheet(instr)
  XLSX.utils.book_append_sheet(wb, ws2, "Instructions")

  const out = XLSX.write(wb, { bookType: "xlsx", type: "buffer" })
  return Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer)
}
