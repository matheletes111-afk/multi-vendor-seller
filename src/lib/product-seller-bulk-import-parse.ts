/** Bulk product import: CSV + XLSX, multi-category via category_id column. */

import * as XLSX from "xlsx"

export const BULK_TEMPLATE_FILENAME_CSV = "product-bulk-template.csv"
export const BULK_TEMPLATE_FILENAME_XLSX = "product-bulk-template.xlsx"
export const BULK_SHEET_NAME = "Products"

/**
 * Column order. category_id = which marketplace category this product belongs to (same for all rows in a product_key group).
 */
export const BULK_COLUMN_KEYS = [
  "product_key",
  "category_id",
  "product_name",
  "description",
  "product_images",
  "subcategory_id",
  "condition",
  "delivery_charge_per_km",
  "variant_name",
  "price",
  "discount",
  "has_gst",
  "stock",
  "sku",
  "variant_images",
  "attributes_json",
  "specification",
  "details",
  "return_type",
  "return_days",
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
    if (KEY_SET.has(h)) {
      colIndexToKey.set(idx, h as BulkColumnKey)
    }
  })

  if (!colIndexToKey.size) {
    return {
      rows: [],
      sheetErrors: [
        ...sheetErrors,
        "No recognized headers. Use the downloaded template (row 1 must list columns such as category_id, product_name, variant_name, price, stock).",
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
  if (!present.has("category_id")) {
    missingCols.push(`Missing required column: "category_id" (use your allowed category id per product group).`)
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
 * Returns dummy data rows based on selected category/subcategories.
 * One example product per selected subcategory.
 */
export function exampleDataRows(
  categoryId: string,
  subcategoryIds: string[],
  categoryName: string,
  subcategoryNames: Record<string, string>
): string[][] {
  const finalCategoryName = categoryName || "My Category"
  const finalSubIds = subcategoryIds.length > 0 ? subcategoryIds : [""]

  return finalSubIds.map((subId, idx) => {
    const subName = subcategoryNames[subId] || ""
    const prodName = subName ? `${finalCategoryName} - ${subName} Example` : `${finalCategoryName} Example Product`
    
    return [
      `GROUP_${idx + 1}`,   // product_key
      categoryId,           // category_id
      prodName,             // product_name
      "This is a dummy product generated for your template. Replace or delete before import.", // description
      "https://example.com/sample-image.jpg", // product_images
      subId,                // subcategory_id
      "NEW",                // condition
      "0",                  // delivery_charge_per_km
      "Default",            // variant_name
      "100.00",             // price
      "0",                  // discount
      "Y",                  // has_gst
      "50",                 // stock
      `SKU-${idx + 1}`,     // sku
      "",                   // variant_images
      '{"color":"blue"}',   // attributes_json
      "Sample specs",       // specification
      "Sample details",     // details
      "NON_RETURNABLE",     // return_type
      "",                   // return_days
      "N",                  // replacement_allowed
    ]
  })
}

export function buildTemplateCsv(
  categoryId: string,
  subcategoryIds: string[],
  categoryName: string,
  subcategoryNames: Record<string, string>
): Buffer {
  const headers = [...BULK_COLUMN_KEYS]
  const headerLine = headers.map(escapeCsvField).join(",")
  const rows = exampleDataRows(categoryId, subcategoryIds, categoryName, subcategoryNames).map((r) =>
    r.map(escapeCsvField).join(",")
  )
  const bom = "\uFEFF"
  const body = `${bom}${headerLine}\r\n${rows.join("\r\n")}\r\n`
  return Buffer.from(body, "utf8")
}

export function buildTemplateXlsx(
  categoryId: string,
  subcategoryIds: string[],
  categoryName: string,
  subcategoryNames: Record<string, string>
): Buffer {
  const headers = [...BULK_COLUMN_KEYS]
  const wb = XLSX.utils.book_new()
  const data = exampleDataRows(categoryId, subcategoryIds, categoryName, subcategoryNames)
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
  XLSX.utils.book_append_sheet(wb, ws, BULK_SHEET_NAME)

  const instr: string[][] = [
    ["Bulk import — read me"],
    [""],
    ["• The Products sheet has 5 example rows. Replace them with your real products or delete them before import."],
    ["• One row = one variant. Same product_key + category_id on multiple rows = multiple variants for one product."],
    ["• category_id must be your allowed category id (copy from the seller panel list)."],
    ["• subcategory_id is optional; must belong to that category. Wrong codes: import is cancelled; nothing is saved until you fix the file."],
    ["• variant_name, price, stock are required per row."],
    ["• attributes_json (optional): per-variant key/value pairs, same as the product form. Example: {\"Size\":\"M\",\"Color\":\"Blue\"}"],
    ["• In CSV, quote the JSON if it contains commas. Leave empty if no attributes."],
    ["• Images: public URLs only; use | between URLs."],
    ["• Max 500 data rows per upload."],
  ]
  const ws2 = XLSX.utils.aoa_to_sheet(instr)
  XLSX.utils.book_append_sheet(wb, ws2, "Instructions")

  const out = XLSX.write(wb, { bookType: "xlsx", type: "buffer" })
  return Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer)
}
