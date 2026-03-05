import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isCustomer } from "@/lib/rbac"

/** GET current customer user for profile/settings page. */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id || !isCustomer(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, image: true, phone: true, phoneCountryCode: true },
  })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  return NextResponse.json(user)
}

/** PUT update customer profile. */
export async function PUT(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || !isCustomer(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = await request.json().catch(() => ({})) as {
    name?: string
    image?: string
    phone?: string
    phoneCountryCode?: string
  }
  const userData: { name?: string; image?: string; phone?: string | null; phoneCountryCode?: string | null } = {}
  if (body.name !== undefined) userData.name = body.name
  if (body.image !== undefined) userData.image = body.image
  if (body.phone !== undefined) userData.phone = body.phone || null
  if (body.phoneCountryCode !== undefined) userData.phoneCountryCode = body.phoneCountryCode || null
  if (Object.keys(userData).length === 0) {
    return NextResponse.json({ success: true })
  }
  await prisma.user.update({
    where: { id: session.user.id },
    data: userData,
  })
  return NextResponse.json({ success: true })
}
