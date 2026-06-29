"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Alert, AlertDescription } from "@/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { PageLoader } from "@/components/ui/page-loader"
import { Plus, Pencil, Trash2, Check, X, Utensils, AlertTriangle, Megaphone } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

type FoodItem = {
  id: string
  name: string
  description: string | null
  price: number
  images: any
  category: string
  isVeg: boolean
  isActive: boolean
}

export function RestaurantFoodsClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [foods, setFoods] = useState<FoodItem[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog states
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadFoods = useCallback(() => {
    setLoading(true)
    fetch("/api/restaurant-seller/foods")
      .then((r) => r.json())
      .then((json) => {
        if (json?.success) {
          setFoods(json.data)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadFoods()
  }, [loadFoods])

  const handleDeleteClick = (food: FoodItem) => {
    setSelectedFood(food)
    setDeleteOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedFood) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/restaurant-seller/foods/${selectedFood.id}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (data.success) {
        setDeleteOpen(false)
        setSelectedFood(null)
        loadFoods()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <PageLoader message="Loading menu items..." />

  const paramsSuccess = searchParams.get("success")

  return (
    <div className="container mx-auto p-6 space-y-6 animate-in fade-in duration-500">
      {paramsSuccess && (
        <Alert className="bg-emerald-50 border-emerald-200 text-emerald-800 rounded-2xl p-4 flex items-center gap-2">
          <Check className="h-5 w-5 text-emerald-600 shrink-0" />
          <AlertDescription className="font-semibold">{decodeURIComponent(paramsSuccess)}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Food Menu</h1>
          <p className="text-muted-foreground mt-2">Manage your restaurant menu, dishes, categories, and prices</p>
        </div>
        <Button asChild className="rounded-xl shadow-lg shadow-primary/20 bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
          <Link href="/restaurant-seller/foods/new">
            <Plus className="mr-2 h-4 w-4" /> Add Food Item
          </Link>
        </Button>
      </div>

      <Card className="rounded-3xl shadow-2xl border-none overflow-hidden bg-background">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent border-b-muted/20">
                <TableHead className="py-5 pl-6">Preview</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Price</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {foods.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-80 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Utensils className="h-16 w-16 mb-4 opacity-10" />
                      <p className="font-semibold text-xl">Your menu is empty</p>
                      <p className="text-sm opacity-70">Add your first dish to showcase it to guests</p>
                      <Button asChild variant="outline" className="mt-6 rounded-xl border-dashed border-emerald-600/50 hover:bg-emerald-50">
                        <Link href="/restaurant-seller/foods/new">Add New Item</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                foods.map((food) => (
                  <TableRow key={food.id} className="hover:bg-muted/10 transition-all border-b-muted/10">
                    <TableCell className="py-4 pl-6">
                      {(() => {
                        let imageUrl: string | null = null;
                        if (Array.isArray(food.images) && food.images.length > 0) {
                          imageUrl = food.images[0];
                        } else if (food.images && typeof food.images === 'string') {
                          try {
                            const parsed = JSON.parse(food.images);
                            if (Array.isArray(parsed) && parsed.length > 0) imageUrl = parsed[0];
                          } catch {}
                        }
                        return imageUrl ? (
                          <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-muted/20 shadow-sm shrink-0">
                            <img src={imageUrl} alt={food.name} className="w-full h-full object-cover transform hover:scale-115 transition-transform duration-500" />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center text-[10px] text-muted-foreground font-bold shrink-0">No Image</div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-base text-slate-800">{food.name}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="rounded-lg font-bold px-3 py-1 bg-slate-50 border text-slate-600">
                        {food.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`rounded-lg px-3 py-1 font-bold ${food.isVeg ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
                        {food.isVeg ? "Veg" : "Non-Veg"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-black text-slate-900 text-base">
                      {formatCurrency(food.price)}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-2">
                        <Button onClick={() => router.push(`/restaurant-seller/admanagement/new?foodId=${food.id}`)} variant="outline" size="sm" className="rounded-xl border-emerald-600/30 text-emerald-700 hover:bg-emerald-50">
                          <Megaphone className="h-4 w-4 mr-1.5 text-emerald-600" /> Promote
                        </Button>
                        <Button asChild variant="outline" size="sm" className="rounded-xl border-muted hover:bg-muted/50">
                          <Link href={`/restaurant-seller/foods/${food.id}/edit`}>
                            <Pencil className="h-4 w-4 mr-1.5" /> Edit
                          </Link>
                        </Button>
                        <Button onClick={() => handleDeleteClick(food)} variant="destructive" size="sm" className="rounded-xl shadow-lg shadow-destructive/10">
                          <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="rounded-3xl border-none bg-white">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 mb-2">
              <AlertTriangle className="h-6 w-6 text-rose-600" />
            </div>
            <DialogTitle className="text-2xl font-black text-center">Delete Dish</DialogTitle>
            <DialogDescription className="text-center pt-2">
              Are you sure you want to delete <span className="font-bold text-slate-900">&quot;{selectedFood?.name}&quot;</span>?
              <br /><br />
              This will remove the item from active menu listings. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4 gap-2 justify-center">
            <Button variant="outline" className="rounded-xl" onClick={() => setDeleteOpen(false)} disabled={submitting}>Cancel</Button>
            <Button variant="destructive" className="rounded-xl font-bold" onClick={handleDeleteConfirm} disabled={submitting}>
              {submitting ? "Deleting..." : "Confirm Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
