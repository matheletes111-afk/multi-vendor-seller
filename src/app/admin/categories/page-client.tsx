"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/ui/sheet"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Separator } from "@/ui/separator"
import { Alert, AlertDescription } from "@/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/ui/dialog"
import { Package, Briefcase, Plus, Pencil, Trash2 } from "lucide-react"

type Category = {
  id: string
  name: string
  description: string | null
  image: string | null
  commissionRate: number
  isActive: boolean
  _count: { products: number; services: number }
}

export function CategoriesPageClient({
  categories,
  params,
  createCategoryForm,
  updateCategoryForm,
  deleteCategoryForm,
}: {
  categories: Category[]
  params: { error?: string; success?: string }
  createCategoryForm: (formData: FormData) => Promise<void>
  updateCategoryForm: (categoryId: string, formData: FormData) => Promise<void>
  deleteCategoryForm: (categoryId: string) => Promise<void>
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground mt-2">Manage product and service categories</p>
        </div>
        {mounted ? (
          <AddCategoryForm createCategoryForm={createCategoryForm} />
        ) : (
          <div className="h-10 w-[140px] rounded-md bg-muted" />
        )}
      </div>

      {params.error && (
        <Alert variant="destructive">
          <AlertDescription>{decodeURIComponent(params.error)}</AlertDescription>
        </Alert>
      )}
      {params.success && (
        <Alert>
          <AlertDescription>{decodeURIComponent(params.success)}</AlertDescription>
        </Alert>
      )}

      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">No categories found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Card key={category.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle>{category.name}</CardTitle>
                    <CardDescription className="mt-1">{category.description || "No description"}</CardDescription>
                  </div>
                  <Badge variant={category.isActive ? "default" : "secondary"}>
                    {category.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Commission Rate</p>
                    <p className="text-lg font-semibold">{category.commissionRate}%</p>
                  </div>
                  <Separator />
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{category._count.products} products</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{category._count.services} services</span>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex justify-end gap-2 pt-2">
                    {mounted ? (
                      <>
                        <EditCategoryForm category={category} updateCategoryForm={updateCategoryForm} />
                        <DeleteCategoryButton
                          categoryId={category.id}
                          categoryName={category.name}
                          productCount={category._count.products}
                          serviceCount={category._count.services}
                          deleteCategoryForm={deleteCategoryForm}
                        />
                      </>
                    ) : (
                      <>
                        <div className="h-9 w-[72px] rounded-md bg-muted" />
                        <div className="h-9 w-[88px] rounded-md bg-muted" />
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function AddCategoryForm({ createCategoryForm }: { createCategoryForm: (formData: FormData) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  async function handleSubmit(formData: FormData) {
    await createCategoryForm(formData)
    setOpen(false)
  }
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add New Category</SheetTitle>
          <SheetDescription>Create a new category for products and services</SheetDescription>
        </SheetHeader>
        <form action={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Category Name *</Label>
            <Input id="name" name="name" placeholder="e.g., Electronics" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" placeholder="Category description" rows={4} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="image">Image URL</Label>
            <Input id="image" name="image" type="url" placeholder="https://example.com/image.jpg" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="commissionRate">Commission Rate (%)</Label>
            <Input id="commissionRate" name="commissionRate" type="number" step="0.1" min="0" max="100" defaultValue="10.0" placeholder="10.0" />
          </div>
          <div className="flex items-center space-x-2">
            <input id="isActive" name="isActive" type="checkbox" defaultChecked value="true" className="h-4 w-4 rounded border-gray-300" />
            <Label htmlFor="isActive" className="text-sm font-normal">Active</Label>
          </div>
          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">Create Category</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function EditCategoryForm({
  category,
  updateCategoryForm,
}: {
  category: Category
  updateCategoryForm: (categoryId: string, formData: FormData) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  async function handleSubmit(formData: FormData) {
    await updateCategoryForm(category.id, formData)
    setOpen(false)
  }
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit Category</SheetTitle>
          <SheetDescription>Update category information and status</SheetDescription>
        </SheetHeader>
        <form action={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Category Name *</Label>
            <Input id="name" name="name" placeholder="e.g., Electronics" defaultValue={category.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" placeholder="Category description" rows={4} defaultValue={category.description || ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="image">Image URL</Label>
            <Input id="image" name="image" type="url" placeholder="https://example.com/image.jpg" defaultValue={category.image || ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="commissionRate">Commission Rate (%)</Label>
            <Input id="commissionRate" name="commissionRate" type="number" step="0.1" min="0" max="100" defaultValue={category.commissionRate} placeholder="10.0" />
          </div>
          <div className="flex items-center space-x-2">
            <input id="isActive" name="isActive" type="checkbox" defaultChecked={category.isActive} value="true" className="h-4 w-4 rounded border-gray-300" />
            <Label htmlFor="isActive" className="text-sm font-normal">Active</Label>
          </div>
          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">Update Category</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function DeleteCategoryButton({
  categoryId,
  categoryName,
  productCount,
  serviceCount,
  deleteCategoryForm,
}: {
  categoryId: string
  categoryName: string
  productCount: number
  serviceCount: number
  deleteCategoryForm: (categoryId: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  async function handleDelete() {
    setIsDeleting(true)
    await deleteCategoryForm(categoryId)
    setOpen(false)
    setIsDeleting(false)
  }
  const hasUsage = productCount > 0 || serviceCount > 0
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Category</DialogTitle>
          <DialogDescription>
            {hasUsage ? (
              <>Cannot delete category &quot;{categoryName}&quot; because it is used by {productCount > 0 && <strong>{productCount} product(s)</strong>}
                {productCount > 0 && serviceCount > 0 && " and "}
                {serviceCount > 0 && <strong>{serviceCount} service(s)</strong>}. Remove or reassign first.</>
            ) : (
              <>Are you sure you want to delete &quot;{categoryName}&quot;? This cannot be undone.</>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isDeleting}>Cancel</Button>
          {!hasUsage && (
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
