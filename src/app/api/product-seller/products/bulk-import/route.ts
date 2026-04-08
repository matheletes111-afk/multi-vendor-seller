import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import { checkProductLimit } from "@/lib/subscriptions"
import { parseBulkFile, type BulkDataRow } from "@/lib/product-seller-bulk-import-parse"
import {
  parseVariantInput,
  sellerHasSelectedCategory,
  slugFromName,
  uniqueSlugSuffix,
  type NormalizedVariant,
  type VariantInput,
} from "@/lib/product-seller-product-payload"

const MAX_DATA_ROWS = 500
const MAX_FILE_BYTES = 8 * 1024 * 1024

function parseImageList(s: string): string[] {
  if (!s?.trim()) return []
  return s.split(/[\n|]+/).map((x) => x.trim()).filter(Boolean)
}

function parseBoolTri(s: string): boolean | undefined {
  const t = s.trim().toLowerCase()
  if (!t) return undefined
  if (["y", "yes", "true", "1"].includes(t)) return true
  if (["n", "no", "false", "0"].includes(t)) return false
  return undefined
}

function parseReplacementTrue(s: string): boolean {
  const t = s.trim().toLowerCase()
  return ["y", "yes", "true", "1"].includes(t)
}

function parseAttributesJson(s: string, excelRow: number): { ok: true; attrs: Record<string, string> } | { ok: false; error: string } {
  if (!s.trim()) return { ok: true, attrs: {} }
  try {
    const o = JSON.parse(s) as unknown
    if (!o || typeof o !== "object" || Array.isArray(o)) {
      return { ok: false, error: `Row ${excelRow}: attributes_json must be a JSON object` }
    }
    const attrs: Record<string, string> = {}
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      attrs[String(k)] = v == null ? "" : String(v)
    }
    return { ok: true, attrs }
  } catch {
    return { ok: false, error: `Row ${excelRow}: invalid attributes_json` }
  }
}

function groupKey(row: BulkDataRow): string {
  const pk = row.cells.product_key?.trim()
  if (pk) return `k:${pk}`
  return `single:${row.excelRow}`
}

type PreparedProduct = {
  categoryId: string
  name: string
  description: string | null
  images: string[]
  subcategoryId: string | null
  condition: string
  variants: NormalizedVariant[]
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } })
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  if (!seller.isApproved) {
    return NextResponse.json({ error: "Your seller account is pending approval." }, { status: 403 })
  }
  if (seller.isSuspended) {
    return NextResponse.json({ error: "Your seller account has been suspended." }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 })
  }

  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Upload a .csv or .xlsx file" }, { status: 400 })
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File too large (max 8 MB)" }, { status: 400 })
  }

  const buf = Buffer.from(await file.arrayBuffer())
  const { rows, sheetErrors } = parseBulkFile(buf, file.name)
  const errors: string[] = [...sheetErrors]

  if (rows.length > MAX_DATA_ROWS) {
    return NextResponse.json(
      { error: `Too many data rows (max ${MAX_DATA_ROWS})`, errors },
      { status: 400 }
    )
  }

  if (rows.length > 0) {
    const hasVariantName = rows.some((r) => (r.cells.variant_name ?? "").trim() !== "")
    if (!hasVariantName) {
      errors.push(
        "No variant data found: at least one row must include variant_name, price, and stock (variant columns are required)."
      )
    }
  }

  if (rows.length === 0) {
    if (errors.length === 0) {
      errors.push("No data rows found. Add at least one product row below the header, with category_id and variant fields.")
    }
    return NextResponse.json({ error: "Import failed", errors }, { status: 400 })
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: "Import validation failed", errors: [...new Set(errors)] }, { status: 400 })
  }

  const groupMap = new Map<string, BulkDataRow[]>()
  for (const row of rows) {
    const k = groupKey(row)
    const list = groupMap.get(k)
    if (list) list.push(row)
    else groupMap.set(k, [row])
  }

  const prepared: PreparedProduct[] = []

  for (const [, groupRows] of groupMap) {
    const errBeforeGroup = errors.length
    const sorted = [...groupRows].sort((a, b) => a.excelRow - b.excelRow)
    const rowNums = sorted.map((r) => r.excelRow).join(", ")

    let productName = ""
    let description: string | null = null
    let productImages: string[] = []
    const subIds = new Set<string>()
    const catIds = new Set<string>()
    let nameConflict = false

    for (const r of sorted) {
      const c = r.cells
      const pn = (c.product_name ?? "").trim()
      if (pn) {
        if (!productName) productName = pn
        else if (pn !== productName) {
          errors.push(`Rows ${rowNums}: conflicting product_name for the same product_key`)
          nameConflict = true
        }
      }

      const cid = (c.category_id ?? "").trim()
      if (cid) catIds.add(cid)

      const desc = (c.description ?? "").trim()
      if (desc && !description) description = desc

      const pImg = parseImageList(c.product_images ?? "")
      if (pImg.length && productImages.length === 0) productImages = pImg

      const rowSub = (c.subcategory_id ?? "").trim()
      if (rowSub) subIds.add(rowSub)
    }

    if (nameConflict) continue

    if (!productName) {
      errors.push(`Row ${sorted[0].excelRow}: product_name is required`)
      continue
    }

    if (catIds.size === 0) {
      errors.push(`Product "${productName}" (rows ${rowNums}): category_id is required for each product group`)
      continue
    }
    if (catIds.size > 1) {
      errors.push(
        `Product "${productName}" (rows ${rowNums}): all rows with the same product key must use the same category_id. Found: ${[...catIds].join(", ")}`
      )
      continue
    }

    const groupCategoryId = [...catIds][0]
    const allowedCat = await sellerHasSelectedCategory(seller.id, groupCategoryId)
    if (!allowedCat) {
      errors.push(
        `Product "${productName}" (rows ${rowNums}): category_id "${groupCategoryId}" is not allowed for your shop — copy a category code from the bulk upload list (or fix a typo).`
      )
      continue
    }

    if (subIds.size > 1) {
      errors.push(
        `Product "${productName}" (rows ${rowNums}): all rows with the same product key must use the same subcategory_id (or all leave it empty). Found: ${[...subIds].join(", ")}`
      )
      continue
    }

    let subcategoryId: string | null = null
    if (subIds.size === 1) {
      subcategoryId = [...subIds][0]
      const sub = await prisma.subcategory.findFirst({
        where: { id: subcategoryId, categoryId: groupCategoryId, isActive: true },
      })
      if (!sub) {
        errors.push(
          `Product "${productName}" (rows ${rowNums}): subcategory_id "${subcategoryId}" does not belong to category "${groupCategoryId}", is inactive, or is wrong — use a type code listed under that category in the panel.`
        )
        continue
      }
    }

    const firstValidCondition = sorted.find(r => (r.cells.condition ?? "").trim())?.cells.condition?.trim().toUpperCase()
    const condition = (firstValidCondition === "USED") ? "USED" : "NEW"

    const variants: NormalizedVariant[] = []
    for (const r of sorted) {
      const c = r.cells
      const vName = (c.variant_name ?? "").trim()
      if (!vName) {
        errors.push(`Row ${r.excelRow}: variant_name is required`)
        continue
      }

      const price = Number(c.price)
      const stock = Number(c.stock)
      const discount = c.discount !== undefined && String(c.discount).trim() !== "" ? Number(c.discount) : 0

      const gstTri = parseBoolTri(c.has_gst ?? "")
      const hasGst = gstTri === undefined ? true : gstTri

      const returnType =
        (c.return_type ?? "").trim().toUpperCase() === "RETURNABLE" ? "RETURNABLE" : "NON_RETURNABLE"
      const returnDaysRaw = String(c.return_days ?? "").trim() ? Number(c.return_days) : undefined
      const returnDays =
        returnType === "RETURNABLE" && typeof returnDaysRaw === "number" && returnDaysRaw > 0
          ? Math.floor(returnDaysRaw)
          : undefined

      const replacementAllowed = returnType === "RETURNABLE" && parseReplacementTrue(c.replacement_allowed ?? "")

      const attrParsed = parseAttributesJson(c.attributes_json ?? "", r.excelRow)
      if (!attrParsed.ok) {
        errors.push(attrParsed.error)
        continue
      }

      const vInput: VariantInput = {
        name: vName,
        price,
        stock,
        discount,
        sku: (c.sku ?? "").trim() || undefined,
        hasGst,
        images: parseImageList(c.variant_images ?? ""),
        attributes: Object.keys(attrParsed.attrs).length ? attrParsed.attrs : undefined,
        specification: (c.specification ?? "").trim() || undefined,
        details: (c.details ?? "").trim() || undefined,
        returnType,
        returnDays,
        replacementAllowed,
      }

      const parsed = parseVariantInput(vInput, variants.length)
      if (!parsed.ok) {
        errors.push(`Row ${r.excelRow}: ${parsed.error}`)
        continue
      }
      variants.push(parsed.variant)
    }

    if (errors.length > errBeforeGroup) continue

    if (variants.length === 0) {
      errors.push(`Product "${productName}" (rows ${rowNums}): no valid variants`)
      continue
    }

    prepared.push({
      categoryId: groupCategoryId,
      name: productName,
      description,
      images: productImages,
      subcategoryId,
      condition,
      variants,
    })
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: "Import validation failed", errors: [...new Set(errors)] }, { status: 400 })
  }

  if (prepared.length === 0) {
    return NextResponse.json({ error: "Nothing to import" }, { status: 400 })
  }

  const limitCheck = await checkProductLimit(seller.id)
  if (!limitCheck.allowed) {
    return NextResponse.json(
      {
        error: `Product limit reached. Plan allows ${limitCheck.limit}. Upgrade to add more.`,
      },
      { status: 403 }
    )
  }
  if (limitCheck.limit != null && limitCheck.current + prepared.length > limitCheck.limit) {
    return NextResponse.json(
      {
        error: `This import would create ${prepared.length} products but your plan allows ${limitCheck.limit} total (${limitCheck.current} in use).`,
      },
      { status: 403 }
    )
  }

  try {
    const created = await prisma.$transaction(
      prepared.map((p) =>
        prisma.product.create({
          data: {
            sellerId: seller.id,
            categoryId: p.categoryId,
            subcategoryId: p.subcategoryId,
            name: p.name,
            slug: `${slugFromName(p.name)}-${uniqueSlugSuffix()}`,
            description: p.description,
            condition: p.condition as any,
            images: (p.images.length ? p.images : []) as object,
            variants: {
              create: p.variants.map((v) => ({
                name: v.name,
                sku: v.sku,
                price: v.price,
                discount: v.discount,
                hasGst: v.hasGst,
                stock: v.stock,
                images: v.images,
                attributes: v.attributes,
                specification: v.specification,
                details: v.details,
                returnType: v.returnType,
                returnDays: v.returnDays ?? undefined,
                replacementAllowed: v.replacementAllowed,
              })),
            },
          } as any,
        })
      )
    )

    const variantCount = prepared.reduce((acc, p) => acc + p.variants.length, 0)
    return NextResponse.json({
      ok: true,
      createdProducts: created.length,
      createdVariants: variantCount,
    })
  } catch (e: unknown) {
    const err = e as { code?: string }
    if (err.code === "P2002") {
      return NextResponse.json({ error: "A product slug conflict occurred. Retry the import." }, { status: 400 })
    }
    console.error("bulk-import", e)
    return NextResponse.json({ error: "Failed to import products" }, { status: 500 })
  }
}
