import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isSuperAdmin } from "@/lib/rbac"
import { BACKOFFICE_MODULES } from "@/lib/permissions"

export const dynamic = "force-dynamic"

// PUT /api/admin/roles/[id] - Update an existing role
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || !isSuperAdmin(session.user)) {
      return NextResponse.json(
        { error: "Forbidden: Super Admin privileges required." },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { name, description, permissions, isActive } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Role name cannot be empty." },
        { status: 400 }
      )
    }

    const cleanName = name.trim()

    // Check duplicate name for other roles
    const existing = await prisma.backofficeRole.findFirst({
      where: {
        name: cleanName,
        id: { not: id },
      },
    })
    if (existing) {
      return NextResponse.json(
        { error: `Another role named "${cleanName}" already exists.` },
        { status: 409 }
      )
    }

    const validKeys = new Set(BACKOFFICE_MODULES.map((m) => m.key))
    const cleanPermissions = Array.isArray(permissions)
      ? permissions.filter((p: string) => validKeys.has(p))
      : []

    const updatedRole = await prisma.backofficeRole.update({
      where: { id },
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
      role: updatedRole,
    })
  } catch (error: any) {
    console.error("Error updating role:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update role." },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/roles/[id] - Delete a role
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || !isSuperAdmin(session.user)) {
      return NextResponse.json(
        { error: "Forbidden: Super Admin privileges required." },
        { status: 403 }
      )
    }

    const { id } = await params

    // Verify role exists and count users assigned
    const role = await prisma.backofficeRole.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true } },
      },
    })

    if (!role) {
      return NextResponse.json({ error: "Role not found." }, { status: 404 })
    }

    // Integrity constraint: cannot delete a role if staff members are currently assigned
    if (role._count.users > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete role "${role.name}": ${role._count.users} staff member(s) are currently assigned to it. Please reassign them to another role first.`,
        },
        { status: 400 }
      )
    }

    await prisma.backofficeRole.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: `Role "${role.name}" was successfully deleted.`,
    })
  } catch (error: any) {
    console.error("Error deleting role:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete role." },
      { status: 500 }
    )
  }
}
