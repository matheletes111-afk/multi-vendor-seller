import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import type { AddressApi } from "../../types"

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

/** PATCH /api/customer/checkout/addresses/[id] — update address. CUSTOMER only. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== UserRole.CUSTOMER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const { id: addressId } = await params
  const existing = await prisma.userAddress.findFirst({
    where: { id: addressId, userId: session.user.id },
  })
  if (!existing) {
    return NextResponse.json({ error: "Address not found" }, { status: 404 })
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
  const fullName = typeof payload.fullName === "string" && payload.fullName.trim() ? payload.fullName.trim() : existing.fullName
  const phone = typeof payload.phone === "string" && payload.phone.trim() ? payload.phone.trim() : existing.phone
  const addressLine1 = typeof payload.addressLine1 === "string" && payload.addressLine1.trim() ? payload.addressLine1.trim() : existing.addressLine1
  const city = typeof payload.city === "string" && payload.city.trim() ? payload.city.trim() : existing.city
  const state = typeof payload.state === "string" && payload.state.trim() ? payload.state.trim() : existing.state
  const postalCode = typeof payload.postalCode === "string" && payload.postalCode.trim() ? payload.postalCode.trim() : existing.postalCode
  const country = typeof payload.country === "string" && payload.country.trim() ? payload.country.trim() : existing.country
  const addressLine2 = typeof payload.addressLine2 === "string" ? payload.addressLine2.trim() || null : existing.addressLine2
  const isDefault = payload.isDefault === true
  if (isDefault && !existing.isDefault) {
    await prisma.userAddress.updateMany({
      where: { userId: session.user.id },
      data: { isDefault: false },
    })
  }
  const updated = await prisma.userAddress.update({
    where: { id: addressId },
    data: {
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
  return NextResponse.json(toAddressApi(updated))
}
