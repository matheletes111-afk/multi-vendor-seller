import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { AddressApi } from "@/app/api/customer/checkout/types"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"

export const dynamic = "force-dynamic"

function unauthorized() {
  return NextResponse.json({ success: false, error: "Unauthorized. Valid customer token required." }, { status: 401 })
}

function toAddressApi(row: {
  id: string
  fullName: string
  phone: string
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string
  postalCode: string
  country: string
  isDefault: boolean
}): AddressApi {
  return {
    id: row.id,
    fullName: row.fullName,
    phone: row.phone,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    country: row.country,
    isDefault: row.isDefault,
  }
}

/** GET /mobileapi/customer/checkout/addresses — list current user's addresses. Auth: Bearer token (customer). */
export async function GET(request: NextRequest) {
  const auth = getMobileCustomerAuth(request)
  if (!auth.ok) return unauthorized()

  const addresses = await prisma.userAddress.findMany({
    where: { userId: auth.userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  })
  const result: AddressApi[] = addresses.map(toAddressApi)
  return NextResponse.json(result)
}

/** POST /mobileapi/customer/checkout/addresses — add address. Auth: Bearer token (customer). */
export async function POST(request: NextRequest) {
  const auth = getMobileCustomerAuth(request)
  if (!auth.ok) return unauthorized()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 })
  }

  const payload = body as {
    fullName?: string
    phone?: string
    addressLine1?: string
    addressLine2?: string | null
    city?: string
    state?: string
    postalCode?: string
    country?: string
    isDefault?: boolean
  }

  const fullName = typeof payload.fullName === "string" && payload.fullName.trim() ? payload.fullName.trim() : null
  const phone = typeof payload.phone === "string" && payload.phone.trim() ? payload.phone.trim() : null
  const addressLine1 =
    typeof payload.addressLine1 === "string" && payload.addressLine1.trim() ? payload.addressLine1.trim() : null
  const city = typeof payload.city === "string" && payload.city.trim() ? payload.city.trim() : null
  const state = typeof payload.state === "string" && payload.state.trim() ? payload.state.trim() : null
  const postalCode =
    typeof payload.postalCode === "string" && payload.postalCode.trim() ? payload.postalCode.trim() : null
  const country = typeof payload.country === "string" && payload.country.trim() ? payload.country.trim() : null

  if (!fullName || !phone || !addressLine1 || !city || !state || !postalCode || !country) {
    return NextResponse.json(
      { error: "Missing required fields: fullName, phone, addressLine1, city, state, postalCode, country" },
      { status: 400 }
    )
  }

  const addressLine2 = typeof payload.addressLine2 === "string" ? payload.addressLine2.trim() || null : null
  const isDefault = payload.isDefault === true

  if (isDefault) {
    await prisma.userAddress.updateMany({
      where: { userId: auth.userId },
      data: { isDefault: false },
    })
  }

  const created = await prisma.userAddress.create({
    data: {
      userId: auth.userId,
      fullName,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      isDefault,
    },
  })

  return NextResponse.json(toAddressApi(created))
}

