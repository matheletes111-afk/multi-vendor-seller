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
  addressType?: "HOME" | "OFFICE" | "OTHER"
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
    addressType: row.addressType ?? "OTHER",
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

/** PATCH /mobileapi/customer/checkout/addresses/[id] — update address. Auth: Bearer token (customer). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getMobileCustomerAuth(request)
  if (!auth.ok) return unauthorized()

  const { id: addressId } = await params

  const existing = await prisma.userAddress.findFirst({
    where: { id: addressId, userId: auth.userId },
  })
  if (!existing) {
    return NextResponse.json({ success: false, error: "Address not found" }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 })
  }

  const payload = body as {
    fullName?: string
    addressType?: "HOME" | "OFFICE" | "OTHER" | string
    phone?: string
    addressLine1?: string
    addressLine2?: string | null
    city?: string
    state?: string
    postalCode?: string
    country?: string
    isDefault?: boolean
  }

  const fullName =
    typeof payload.fullName === "string" && payload.fullName.trim() ? payload.fullName.trim() : existing.fullName
  const addressTypeCandidate = typeof payload.addressType === "string" ? payload.addressType.trim().toUpperCase() : null
  const addressType: "HOME" | "OFFICE" | "OTHER" =
    addressTypeCandidate === "HOME" ||
    addressTypeCandidate === "OFFICE" ||
    addressTypeCandidate === "OTHER"
      ? addressTypeCandidate
      : ((existing as any).addressType as "HOME" | "OFFICE" | "OTHER" | undefined) ?? "OTHER"
  const phone = typeof payload.phone === "string" && payload.phone.trim() ? payload.phone.trim() : existing.phone
  const addressLine1 =
    typeof payload.addressLine1 === "string" && payload.addressLine1.trim()
      ? payload.addressLine1.trim()
      : existing.addressLine1
  const city = typeof payload.city === "string" && payload.city.trim() ? payload.city.trim() : existing.city
  const state = typeof payload.state === "string" && payload.state.trim() ? payload.state.trim() : existing.state
  const postalCode =
    typeof payload.postalCode === "string" && payload.postalCode.trim() ? payload.postalCode.trim() : existing.postalCode
  const country =
    typeof payload.country === "string" && payload.country.trim() ? payload.country.trim() : existing.country
  const addressLine2 = typeof payload.addressLine2 === "string" ? payload.addressLine2.trim() || null : existing.addressLine2

  const isDefault = payload.isDefault === true
  if (isDefault && !existing.isDefault) {
    await prisma.userAddress.updateMany({
      where: { userId: auth.userId },
      data: { isDefault: false },
    })
  }

  const updated = await prisma.userAddress.update({
    where: { id: addressId },
    data: {
      fullName,
      addressType,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      isDefault,
    } as any,
  })

  return NextResponse.json(toAddressApi(updated))
}

/** DELETE /mobileapi/customer/checkout/addresses/[id] — delete address. Auth: Bearer token (customer). */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getMobileCustomerAuth(request)
  if (!auth.ok) return unauthorized()

  const { id: addressId } = await params

  const existing = await prisma.userAddress.findFirst({
    where: { id: addressId, userId: auth.userId },
    select: { id: true, isDefault: true },
  })
  if (!existing) {
    return NextResponse.json({ success: false, error: "Address not found" }, { status: 404 })
  }

  await prisma.userAddress.delete({ where: { id: addressId } })

  // If we deleted the default address, promote the oldest remaining address to default (deterministic).
  if (existing.isDefault) {
    const remaining = await prisma.userAddress.findFirst({
      where: { userId: auth.userId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    })
    if (remaining) {
      await prisma.userAddress.update({ where: { id: remaining.id }, data: { isDefault: true } })
    }
  }

  return NextResponse.json({ success: true })
}

