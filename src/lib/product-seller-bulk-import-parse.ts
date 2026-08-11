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
    const key = h === "variant_images" ? "product_variant_images" : h
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
        "This is an example product description. Replace or delete before import.", // product_description
        "NEW",                // condition
        "0",                  // delivery_charge_per_km
        "Standard Version",   // variant_name
        "99.99",              // price
        "10",                 // discount
        "Yes",                // gst_applicable
        "100",                // stock
        `SKU-${idx + 1}-STD`, // sku_code
        "0.5",                // weight (kg)
        "10",                 // height (cm)
        "10",                 // width (cm)
        "10",                 // depth (cm)
        "https://example.com/variant-std.jpg", // product_variant_images
        '{"color":"Black","size":"Regular"}', // variant_details
        "Standard specification", // specifications
        "Standard details",   // additional_details
        "Returnable",         // return_policy
        "7",                  // return_limit_days
        "Yes",                // replacement_allowed
      ],
      [
        catName,              // category
        prodName,             // product_name
        "This is an example product description. Replace or delete before import.", // product_description
        "NEW",                // condition
        "0",                  // delivery_charge_per_km
        "Premium Version",    // variant_name
        "149.99",             // price
        "15",                 // discount
        "Yes",                // gst_applicable
        "50",                 // stock
        `SKU-${idx + 1}-PREM`,// sku_code
        "1.2",                // weight (kg)
        "15",                 // height (cm)
        "15",                 // width (cm)
        "15",                 // depth (cm)
        "https://example.com/variant-prem.jpg", // product_variant_images
        '{"color":"Gold","size":"Premium"}', // variant_details
        "Premium specification", // specifications
        "Premium details",    // additional_details
        "Returnable",         // return_policy
        "7",                  // return_limit_days
        "Yes",                // replacement_allowed
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
    ["Bulk Import Instructions & Guide"],
    [""],
    ["1. MULTIPLE VARIANTS GROUPING:"],
    ["• Each row in the 'Products' sheet represents ONE variant."],
    ["• To create 1 Product with Multiple Variants (e.g. Size S, M, L), use the EXACT SAME 'product_name' and 'category' for all variant rows."],
    ["• The system automatically groups rows with matching product_name into a single product listing."],
    [""],
    ["2. REQUIRED COLUMNS:"],
    ["• category: Write the exact or closest matching category name (e.g. 'Electronics', 'Clothing')."],
    ["• product_name: The name of the product."],
    ["• variant_name: Name of the variant (e.g. 'Red / Large', '64GB', 'Standard')."],
    ["• price: Price for this variant (e.g. 299.99)."],
    ["• stock: Quantity in stock (e.g. 50)."],
    [""],
    ["3. IMAGES, WEIGHT & DIMENSIONS:"],
    ["• weight (optional/mandatory depending on category): Weight in kg (e.g. 0.5). Mandatory if category requires weight."],
    ["• height, width, depth (optional): Package dimensions in cm (e.g. 10)."],
    ["• product_variant_images: Public image URLs separated by vertical bar (|) or newlines. E.g. https://example.com/img1.jpg|https://example.com/img2.jpg"],
    ["• variant_details (optional): Attributes in JSON format. E.g. {\"color\":\"Black\",\"size\":\"L\"}"],
    ["• condition (optional): 'NEW' or 'USED' (default is NEW)."],
    ["• delivery_charge_per_km (optional): Additional delivery charge per km (default 0)."],
    [""],
    ["4. FILE LIMITS:"],
    ["• Maximum 500 data rows per Excel/CSV import."],
    ["• Please replace or delete the example rows in the 'Products' tab before importing."],
  ]
  const ws2 = XLSX.utils.aoa_to_sheet(instr)
  XLSX.utils.book_append_sheet(wb, ws2, "Instructions")

  const out = XLSX.write(wb, { bookType: "xlsx", type: "buffer" })
  return Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer)
}
