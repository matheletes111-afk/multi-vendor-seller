import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isSuperAdmin } from "@/lib/rbac"
import { BACKOFFICE_MODULES } from "@/lib/permissions"

export const dynamic = "force-dynamic"

// GET /api/admin/roles - List all backoffice roles
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user || !isSuperAdmin(session.user)) {
      return NextResponse.json(
        { error: "Forbidden: Super Admin privileges required." },
        { status: 403 }
      )
    }

    const roles = await prisma.backofficeRole.findMany({
      include: {
        _count: {
          select: { users: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      success: true,
      roles,
      availableModules: BACKOFFICE_MODULES,
    })
  } catch (error: any) {
    console.error("Error fetching backoffice roles:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch roles." },
      { status: 500 }
    )
  }
}

// POST /api/admin/roles - Create a new backoffice role
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !isSuperAdmin(session.user)) {
      return NextResponse.json(
        { error: "Forbidden: Super Admin privileges required." },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, description, permissions, isActive } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Role name is required." },
        { status: 400 }
      )
    }

    const cleanName = name.trim()

    // Check if role name already exists
    const existing = await prisma.backofficeRole.findUnique({
      where: { name: cleanName },
    })
    if (existing) {
      return NextResponse.json(
        { error: `A role named "${cleanName}" already exists.` },
        { status: 409 }
      )
    }

    // Sanitize permissions list against valid module keys
    const validKeys = new Set(BACKOFFICE_MODULES.map((m) => m.key))
    const cleanPermissions = Array.isArray(permissions)
      ? permissions.filter((p: string) => validKeys.has(p))
      : []

    const newRole = await prisma.backofficeRole.create({
      data: {
        name: cleanName,
        description: description?.trim() || null,
        permissions: cleanPermissions,
        isActive: isActive !== false,
      },
      include: {
        _count: { select: { users: true } },
      },
    })

    return NextResponse.json({
      success: true,
      role: newRole,
    })
  } catch (error: any) {
    console.error("Error creating backoffice role:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create role." },
      { status: 500 }
    )
  }
}
