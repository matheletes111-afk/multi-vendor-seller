"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { ChevronLeft, Utensils } from "lucide-react"

export function NewFoodClient() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [category, setCategory] = useState("")
  const [isVeg, setIsVeg] = useState(true)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [cuisines, setCuisines] = useState<string[]>([])
  const [errorMsg, setErrorMsg] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useState(() => {
    fetch("/api/restaurant-seller/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data && data.primaryCuisine) {
          try {
            const parsed = typeof data.primaryCuisine === "string"
              ? JSON.parse(data.primaryCuisine)
              : data.primaryCuisine
            if (Array.isArray(parsed)) {
              setCuisines(parsed)
              if (parsed.length > 0) {
                setCategory(parsed[0])
              }
            }
          } catch (e) {
            console.error(e)
          }
        }
      })
      .catch(console.error)
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !price || !category) {
      setErrorMsg("Please fill in all required fields.")
      return
    }
    setSubmitting(true)
    setErrorMsg("")

    try {
      const formData = new FormData()
      formData.append("name", name)
      formData.append("description", description)
      formData.append("price", price)
      formData.append("category", category)
      formData.append("isVeg", String(isVeg))
      if (imageFiles.length > 0) {
        imageFiles.forEach((file) => {
          formData.append("images", file)
        })
      }

      const res = await fetch("/api/restaurant-seller/foods", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()

      if (data.success) {
        router.push("/restaurant-seller/foods?success=Food+item+created+successfully")
        router.refresh()
      } else {
        setErrorMsg(data.error || "Failed to create food item.")
      }
    } catch (err) {
      setErrorMsg("Failed to connect to server.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon" className="rounded-full">
          <Link href="/restaurant-seller/foods">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-black tracking-tight">Add Menu Item</h1>
          <p className="text-muted-foreground">Add a new dish to your restaurant menu</p>
        </div>
      </div>

      <Card className="rounded-3xl border-none shadow-2xl overflow-hidden bg-background">
        <CardHeader className="bg-muted/30 border-b border-muted/20 pb-6">
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <Utensils className="h-5 w-5 text-emerald-600" />
            Dish Information
          </CardTitle>
          <CardDescription>Fill out the fields below to showcase your dish.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-bold text-slate-700">Dish Name *</Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 rounded-xl"
                placeholder="e.g. Butter Chicken"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="price" className="text-sm font-bold text-slate-700">Price *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="h-12 rounded-xl"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category" className="text-sm font-bold text-slate-700">Category *</Label>
                {cuisines.length > 0 ? (
                  <select
                    id="category"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-12 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    {cuisines.map((cuisine) => (
                      <option key={cuisine} value={cuisine}>
                        {cuisine}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id="category"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="h-12 rounded-xl"
                    placeholder="e.g. Mains, Starters, Desserts"
                  />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-bold text-slate-700">Description</Label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none h-32"
                placeholder="Describe ingredients, tastes, allergens..."
              />
            </div>

            <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-2xl p-4">
              <div>
                <h4 className="text-sm font-bold text-slate-700">Vegetarian Option</h4>
                <p className="text-xs text-slate-400 mt-0.5">Toggle on if this dish is 100% vegetarian</p>
              </div>
              <button
                type="button"
                onClick={() => setIsVeg(!isVeg)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  isVeg ? "bg-emerald-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isVeg ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="images" className="text-sm font-bold text-slate-700">Dish Photos (Multiple)</Label>
              <Input
                id="images"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  if (e.target.files) {
                    setImageFiles((prev) => [...prev, ...Array.from(e.target.files!)])
                  }
                }}
                className="rounded-xl pt-2.5 h-12 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
              />
              {imageFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  <Label className="text-xs font-bold text-slate-500">Image Previews</Label>
                  <div className="flex flex-wrap gap-4">
                    {imageFiles.map((file, idx) => {
                      const objectUrl = URL.createObjectURL(file)
                      return (
                        <div key={idx} className="relative w-32 h-20 rounded-xl overflow-hidden border border-slate-200 group">
                          <img src={objectUrl} alt="Preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              setImageFiles((prev) => prev.filter((_, i) => i !== idx))
                            }}
                            className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-1 opacity-90 hover:opacity-100 hover:scale-105 transition-all text-[10px]"
                          >
                            Remove
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {errorMsg && <p className="text-sm font-bold text-rose-600">{errorMsg}</p>}

            <div className="flex items-center gap-4 pt-4 border-t border-slate-100">
              <Button type="submit" disabled={submitting} size="lg" className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 shadow-lg shadow-emerald-600/10">
                {submitting ? "Creating..." : "Create Dish"}
              </Button>
              <Button asChild type="button" variant="outline" size="lg" className="rounded-xl">
                <Link href="/restaurant-seller/foods">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
