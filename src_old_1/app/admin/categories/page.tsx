import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Separator } from "@/ui/separator"
import { Alert, AlertDescription } from "@/ui/alert"
import { Package, Briefcase } from "lucide-react"
import { CategoriesPageClient } from "./page-client"

// Validations (same file as page)
const createCategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  image: z.string().url().optional().or(z.literal("")),
  commissionRate: z.number().min(0).max(100).default(10.0),
  isActive: z.boolean().default(true),
})

const updateCategorySchema = createCategorySchema.partial().extend({
  name: z.string().min(1, "Name is required"),
})

// Server actions (inline in page)
async function createCategory(data: unknown) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) return { error: "Unauthorized" }
  const validated = createCategorySchema.safeParse(data)
  if (!validated.success) {
    const msg = validated.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")
    return { error: `Validation failed: ${msg}`, details: validated.error.errors }
  }
  const slug = validated.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  try {
    await prisma.category.create({
      data: {
        name: validated.data.name,
        slug,
        description: validated.data.description || null,
        image: validated.data.image || null,
        commissionRate: validated.data.commissionRate,
        isActive: validated.data.isActive,
      },
    })
    revalidatePath("/admin/categories")
    return { success: true }
  } catch (error: any) {
    if (error.code === "P2002") return { error: "Category with this name already exists" }
    return { error: `Failed to create category: ${error.message || "Unknown error"}` }
  }
}

async function updateCategory(categoryId: string, data: unknown) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) return { error: "Unauthorized" }
  const category = await prisma.category.findUnique({ where: { id: categoryId } })
  if (!category) return { error: "Category not found" }
  const validated = updateCategorySchema.safeParse(data)
  if (!validated.success) {
    const msg = validated.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")
    return { error: `Validation failed: ${msg}`, details: validated.error.errors }
  }
  let updateData: any = { ...validated.data }
  if (validated.data.name && validated.data.name !== category.name) {
    updateData.slug = validated.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  }
  Object.keys(updateData).forEach((k) => { if (updateData[k] === undefined) delete updateData[k] })
  try {
    await prisma.category.update({ where: { id: categoryId }, data: updateData })
    revalidatePath("/admin/categories")
    return { success: true }
  } catch (error: any) {
    if (error.code === "P2002") return { error: "Category with this name already exists" }
    return { error: `Failed to update category: ${error.message || "Unknown error"}` }
  }
}

async function deleteCategory(categoryId: string) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) return { error: "Unauthorized" }
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { _count: { select: { products: true, services: true } } },
  })
  if (!category) return { error: "Category not found" }
  if (category._count.products > 0 || category._count.services > 0) {
    const parts = []
    if (category._count.products > 0) parts.push(`${category._count.products} product(s)`)
    if (category._count.services > 0) parts.push(`${category._count.services} service(s)`)
    return { error: `Cannot delete category. In use by ${parts.join(" and ")}.` }
  }
  try {
    await prisma.category.delete({ where: { id: categoryId } })
    revalidatePath("/admin/categories")
    return { success: true }
  } catch (error: any) {
    return { error: `Failed to delete: ${error.message || "Unknown error"}` }
  }
}

async function createCategoryForm(formData: FormData) {
  "use server"
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) redirect("/login?error=session_expired")
  const name = formData.get("name") as string
  if (!name) redirect("/admin/categories?error=name_required")
  let commissionRate = 10.0
  const cr = formData.get("commissionRate") as string
  if (cr?.trim()) { const p = parseFloat(cr); if (!isNaN(p) && p >= 0 && p <= 100) commissionRate = p }
  const data = {
    name,
    description: (formData.get("description") as string) || undefined,
    image: (formData.get("image") as string) || undefined,
    commissionRate,
    isActive: (formData.get("isActive") as string) === "true",
  }
  const result = await createCategory(data)
  if (result.error) redirect(`/admin/categories?error=${encodeURIComponent(typeof result.error === "string" ? result.error : "Failed")}`)
  redirect("/admin/categories?success=Category created successfully")
}

async function updateCategoryForm(categoryId: string, formData: FormData) {
  "use server"
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) redirect("/login?error=session_expired")
  const name = formData.get("name") as string
  if (!name) redirect(`/admin/categories?error=name_required`)
  let commissionRate: number | undefined
  const cr = formData.get("commissionRate") as string
  if (cr?.trim()) { const p = parseFloat(cr); if (!isNaN(p) && p >= 0 && p <= 100) commissionRate = p }
  const data: any = {
    name,
    description: (formData.get("description") as string) || undefined,
    image: (formData.get("image") as string) || undefined,
    isActive: (formData.get("isActive") as string) === "true",
  }
  if (commissionRate !== undefined) data.commissionRate = commissionRate
  const result = await updateCategory(categoryId, data)
  if (result.error) redirect(`/admin/categories?error=${encodeURIComponent(typeof result.error === "string" ? result.error : "Failed")}`)
  redirect("/admin/categories?success=Category updated successfully")
}

async function deleteCategoryForm(categoryId: string) {
  "use server"
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) redirect("/login?error=session_expired")
  const result = await deleteCategory(categoryId)
  if (result.error) redirect(`/admin/categories?error=${encodeURIComponent(typeof result.error === "string" ? result.error : "Failed")}`)
  redirect("/admin/categories?success=Category deleted successfully")
}

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const session = await auth()

  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }

  const params = await searchParams
  const categories = await prisma.category.findMany({
    include: {
      _count: {
        select: {
          products: true,
          services: true,
        },
      },
    },
    orderBy: { name: "asc" },
  })

  return (
    <CategoriesPageClient
      categories={categories}
      params={params}
      createCategoryForm={createCategoryForm}
      updateCategoryForm={updateCategoryForm}
      deleteCategoryForm={deleteCategoryForm}
    />
  )
}
