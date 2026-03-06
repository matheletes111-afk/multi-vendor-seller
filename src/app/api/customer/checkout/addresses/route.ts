import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import type { AddressApi } from "../types"

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

/** GET /api/customer/checkout/addresses — list current user's addresses. CUSTOMER only. */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== UserRole.CUSTOMER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const addresses = await prisma.userAddress.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  })
  const result: AddressApi[] = addresses.map(toAddressApi)
  return NextResponse.json(result)
}

/** POST /api/customer/checkout/addresses — add address. CUSTOMER only. */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== UserRole.CUSTOMER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
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
  const addressLine1 = typeof payload.addressLine1 === "string" && payload.addressLine1.trim() ? payload.addressLine1.trim() : null
  const city = typeof payload.city === "string" && payload.city.trim() ? payload.city.trim() : null
  const state = typeof payload.state === "string" && payload.state.trim() ? payload.state.trim() : null
  const postalCode = typeof payload.postalCode === "string" && payload.postalCode.trim() ? payload.postalCode.trim() : null
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
      where: { userId: session.user.id },
      data: { isDefault: false },
    })
  }
  const created = await prisma.userAddress.create({
    data: {
      userId: session.user.id,
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
