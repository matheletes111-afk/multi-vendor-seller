"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Star, MapPin, Sparkles, Plus, Minus, ShoppingBag, AlertTriangle, X, Utensils } from "lucide-react"
import { Button } from "@/ui/button"
import { Card, CardContent } from "@/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/ui/dialog"
import { formatCurrency } from "@/lib/utils"
import { PublicLayout } from "@/components/site-layout"

type FoodItem = {
  id: string
  name: string
  description: string | null
  price: number
  image: string | null
  category: string
  isVeg: boolean
  averageRating: number
  totalReviews: number
}

type RestaurantDetail = {
  id: string
  businessName: string
  cuisines: string[]
  logo: string | null
  banner: string | null
  mainPhoto: string | null
  street: string
  city: string
  state: string
  landmark: string
  averageRating: number
  totalReviews: number
  foods: FoodItem[]
}

type CartItem = {
  foodItemId: string
  name: string
  price: number
  quantity: number
  image: string | null
  isVeg: boolean
  category: string
}

type LocalFoodCart = {
  restaurantId: string
  restaurantName: string
  items: CartItem[]
}

export default function RestaurantMenuPage() {
  const { id } = useParams()
  const router = useRouter()
  
  const [restaurant, setRestaurant] = useState<RestaurantDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedVegFilter, setSelectedVegFilter] = useState("ALL") // ALL, VEG, NON-VEG
  
  // Local Cart State
  const [cart, setCart] = useState<LocalFoodCart | null>(null)
  const [conflictItem, setConflictItem] = useState<{ item: FoodItem; qty: number } | null>(null)
  const [conflictOpen, setConflictOpen] = useState(false)
  const [showCartSummary, setShowCartSummary] = useState(false)

  const fetchRestaurantDetails = async () => {
    try {
      const res = await fetch(`/api/customer/restaurants/${id}`)
      const data = await res.json()
      if (data.success) {
        setRestaurant(data.data)
      }
    } catch (err) {
      console.error("Failed to load restaurant:", err)
    } finally {
      setLoading(false)
    }
  }

  // Load cart from storage
  useEffect(() => {
    if (id) fetchRestaurantDetails()
    
    const stored = localStorage.getItem("meeem-food-cart")
    if (stored) {
      try {
        setCart(JSON.parse(stored))
      } catch {
        setCart(null)
      }
    }
  }, [id])

  const saveCartToStorage = (newCart: LocalFoodCart | null) => {
    setCart(newCart)
    if (newCart) {
      localStorage.setItem("meeem-food-cart", JSON.stringify(newCart))
    } else {
      localStorage.removeItem("meeem-food-cart")
    }
  }

  const handleAddToCart = (item: FoodItem, qty = 1) => {
    if (!restaurant) return

    // Check if cart has items from another restaurant
    if (cart && cart.items.length > 0 && cart.restaurantId !== restaurant.id) {
      setConflictItem({ item, qty })
      setConflictOpen(true)
      return
    }

    const currentItems = cart ? [...cart.items] : []
    const existingIdx = currentItems.findIndex(i => i.foodItemId === item.id)

    if (existingIdx > -1) {
      currentItems[existingIdx].quantity += qty
      if (currentItems[existingIdx].quantity <= 0) {
        currentItems.splice(existingIdx, 1)
      }
    } else if (qty > 0) {
      currentItems.push({
        foodItemId: item.id,
        name: item.name,
        price: item.price,
        quantity: qty,
        image: item.image,
        isVeg: item.isVeg,
        category: item.category
      })
    }

    if (currentItems.length === 0) {
      saveCartToStorage(null)
    } else {
      saveCartToStorage({
        restaurantId: restaurant.id,
        restaurantName: restaurant.businessName,
        items: currentItems
      })
    }
  }

  const handleResolveConflict = () => {
    if (!conflictItem || !restaurant) return

    // Clear existing cart and start new
    const newCart: LocalFoodCart = {
      restaurantId: restaurant.id,
      restaurantName: restaurant.businessName,
      items: [
        {
          foodItemId: conflictItem.item.id,
          name: conflictItem.item.name,
          price: conflictItem.item.price,
          quantity: conflictItem.qty,
          image: conflictItem.item.image,
          isVeg: conflictItem.item.isVeg,
          category: conflictItem.item.category
        }
      ]
    }
    saveCartToStorage(newCart)
    setConflictOpen(false)
    setConflictItem(null)
  }

  const getItemQty = (itemId: string) => {
    if (!cart || cart.restaurantId !== id) return 0
    const matched = cart.items.find(i => i.foodItemId === itemId)
    return matched ? matched.quantity : 0
  }

  if (loading) {
    return (
      <PublicLayout>
        <div className="container mx-auto px-4 py-16 text-center space-y-4 max-w-lg">
          <div className="h-12 w-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-amber-800/80 font-bold">Loading delicious menu...</p>
        </div>
      </PublicLayout>
    )
  }

  if (!restaurant) {
    return (
      <PublicLayout>
        <div className="container mx-auto px-4 py-16 text-center space-y-6 max-w-md">
          <AlertTriangle className="h-16 w-16 text-amber-600 mx-auto animate-bounce" />
          <h2 className="text-2xl font-black text-amber-950">Restaurant Not Found</h2>
          <p className="text-amber-900/60 font-semibold">The restaurant is temporarily offline or does not exist.</p>
          <Link href="/foods">
            <Button className="bg-amber-500 text-amber-950 rounded-full font-bold px-6">Return to Directory</Button>
          </Link>
        </div>
      </PublicLayout>
    )
  }

  // Filter foods list
  const filteredFoods = restaurant.foods.filter(f => {
    if (selectedVegFilter === "VEG") return f.isVeg
    if (selectedVegFilter === "NON_VEG") return !f.isVeg
    return true
  })

  // Group foods by category
  const categories = Array.from(new Set(filteredFoods.map(f => f.category)))

  // Calculate cart totals
  const totalCartItems = cart?.restaurantId === restaurant.id ? cart.items.reduce((acc, i) => acc + i.quantity, 0) : 0
  const cartSubtotal = cart?.restaurantId === restaurant.id ? cart.items.reduce((acc, i) => acc + i.price * i.quantity, 0) : 0

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-8 animate-in fade-in duration-500 bg-[#FAF8F5] text-amber-950 pb-28">
        
        {/* Back Button */}
        <div>
          <Link href="/foods" className="inline-flex items-center gap-2 text-sm font-bold text-amber-900/70 hover:text-amber-600 transition-colors bg-white/80 backdrop-blur-md px-4 py-2 rounded-full border border-[#F5EFE6] shadow-sm">
            <ArrowLeft className="h-4 w-4" /> Back to directory
          </Link>
        </div>

        {/* Restaurant Hero Banner Image */}
        {(restaurant.banner || restaurant.mainPhoto) && (
          <div className="relative rounded-[2.5rem] overflow-hidden h-48 sm:h-72 w-full border border-[#F5EFE6] shadow-md">
            <img
              src={restaurant.banner || restaurant.mainPhoto!}
              alt={`${restaurant.businessName} banner`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            <div className="absolute bottom-5 left-6 right-6 flex items-end justify-between">
              <div className="space-y-1">
                <h1 className="text-2xl sm:text-3xl font-black text-white drop-shadow-lg leading-tight">
                  {restaurant.businessName}
                </h1>
                <div className="flex flex-wrap gap-1.5">
                  {restaurant.cuisines.map((c, i) => (
                    <span key={i} className="text-[10px] font-bold text-white/90 bg-white/20 backdrop-blur-sm px-2.5 py-0.5 rounded-full border border-white/20">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
              {restaurant.averageRating > 0 && (
                <div className="flex items-center gap-1 bg-emerald-500 text-white text-xs font-black px-3 py-1.5 rounded-xl shadow-md shrink-0">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  {restaurant.averageRating}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Restaurant Header */}
        <div className="relative rounded-[2.5rem] overflow-hidden border border-[#F5EFE6] bg-white shadow-md p-6 sm:p-10 flex flex-col md:flex-row gap-6 items-center">
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-100/30 rounded-full blur-3xl pointer-events-none" />
          
          {/* Logo or banner preview */}
          <div className="relative h-28 w-28 sm:h-36 sm:w-36 rounded-[2rem] overflow-hidden border border-[#F5EFE6] shrink-0 bg-amber-50 shadow-sm flex items-center justify-center">
            {restaurant.logo ? (
              <img src={restaurant.logo} alt={restaurant.businessName} className="h-full w-full object-cover" />
            ) : (
              <Utensils className="h-16 w-16 text-amber-200" />
            )}
          </div>

          <div className="flex-1 text-center md:text-left space-y-3">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-amber-950 leading-tight">
              {restaurant.businessName}
            </h1>
            
            {/* Cuisines */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5">
              {restaurant.cuisines.map((c, i) => (
                <span key={i} className="text-xs font-bold text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200/50">
                  {c}
                </span>
              ))}
            </div>

            {/* Rating / Address */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-2 pt-1 text-xs sm:text-sm font-bold text-amber-900/60">
              <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1 rounded-full shrink-0">
                <Star className="h-4 w-4 fill-emerald-600 text-emerald-600" />
                <span>{restaurant.averageRating > 0 ? `${restaurant.averageRating} Rating` : "New Restaurant"}</span>
                {restaurant.totalReviews > 0 && <span className="font-semibold text-emerald-600/80">({restaurant.totalReviews})</span>}
              </div>

              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4 text-amber-600 shrink-0" />
                <span>{restaurant.street ? `${restaurant.street}, ` : ""}{restaurant.city}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Menu Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-[#F5EFE6] rounded-3xl p-4 shadow-sm">
          <span className="font-black text-amber-950 uppercase tracking-wider text-sm flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-amber-500" /> Menu Dishes ({filteredFoods.length})
          </span>

          <div className="flex gap-2 w-full sm:w-auto">
            {["ALL", "VEG", "NON_VEG"].map((type) => (
              <button
                key={type}
                onClick={() => setSelectedVegFilter(type)}
                className={`flex-1 sm:flex-none px-5 py-2 text-xs font-bold rounded-xl border transition-all ${
                  selectedVegFilter === type
                    ? "bg-amber-500 border-amber-500 text-amber-950 shadow-md"
                    : "border-[#F5EFE6] bg-[#FAF8F5] text-amber-850 hover:bg-[#F5EFE6]"
                }`}
              >
                {type === "ALL" ? "All Dishes" : type === "VEG" ? "Veg Only 🟢" : "Non-Veg Only 🔴"}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Categories & Food Items */}
        {categories.length === 0 ? (
          <div className="text-center py-16 bg-white border border-[#F5EFE6] rounded-3xl shadow-sm">
            <p className="text-amber-850/60 font-bold text-sm">No dishes match the selected food type.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {categories.map((category) => (
              <div key={category} className="space-y-4">
                <h2 className="text-xl sm:text-2xl font-black text-amber-950 tracking-tight border-b-2 border-amber-500/20 pb-2 pl-1">
                  {category}
                </h2>
                
                <div className="grid grid-cols-2 gap-3">
                  {filteredFoods.filter(f => f.category === category).map((food) => {
                    const quantityInCart = getItemQty(food.id)
                    return (
                      <Card key={food.id} className="rounded-2xl border border-[#F5EFE6] overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-white flex flex-col group">
                        
                        {/* Food Image — top */}
                        <div className="relative w-full h-32 bg-amber-50 overflow-hidden shrink-0">
                          {food.image ? (
                            <img src={food.image} alt={food.name} className="object-cover h-full w-full group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center">
                              <Utensils className="h-10 w-10 text-amber-200" />
                            </div>
                          )}
                          {/* Veg/Non-veg dot */}
                          <div className={`absolute top-2 left-2 h-4 w-4 border-2 rounded-sm flex items-center justify-center bg-white ${food.isVeg ? "border-emerald-500" : "border-rose-500"}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${food.isVeg ? "bg-emerald-500" : "bg-rose-500"}`} />
                          </div>
                        </div>

                        {/* Food Details — bottom */}
                        <div className="p-3 flex flex-col justify-between gap-2 flex-1">
                          <div className="space-y-0.5">
                            <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">{food.category}</span>
                            <h3 className="text-xs font-black text-amber-950 leading-tight group-hover:text-amber-600 transition-colors line-clamp-2">{food.name}</h3>
                            <p className="text-amber-900/50 text-[10px] font-semibold line-clamp-2 leading-relaxed">{food.description || "Fresh ingredients prepared by our expert kitchen."}</p>
                          </div>

                          <div className="flex items-center justify-between gap-1 pt-1">
                            <span className="text-sm font-black text-amber-950">{formatCurrency(food.price)}</span>
                            
                            {/* Quantity Controls */}
                            {quantityInCart > 0 ? (
                              <div className="flex items-center border border-amber-200 rounded-lg overflow-hidden bg-amber-50">
                                <button onClick={() => handleAddToCart(food, -1)} className="px-1.5 py-1 text-amber-700 hover:bg-white transition-colors">
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="px-2 font-black text-amber-950 text-xs">{quantityInCart}</span>
                                <button onClick={() => handleAddToCart(food, 1)} className="px-1.5 py-1 text-amber-700 hover:bg-white transition-colors">
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleAddToCart(food, 1)}
                                className="bg-amber-500 hover:bg-amber-600 text-amber-950 rounded-lg font-black text-xs h-7 px-3 flex items-center gap-0.5 shadow-sm border border-amber-600/10 transition-colors"
                              >
                                ADD <Plus className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sticky/Floating Cart Summary Drawer at the bottom */}
        {totalCartItems > 0 && cart && (
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-amber-100 shadow-[0_-8px_30px_rgb(0,0,0,0.12)] p-4 sm:p-5 flex items-center justify-between gap-4 max-w-6xl mx-auto rounded-t-[2rem]">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-950 shrink-0">
                <ShoppingBag className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="font-black text-amber-950 text-sm">{totalCartItems} Item{totalCartItems === 1 ? "" : "s"} Added</p>
                <p className="text-xs text-amber-900/60 font-semibold leading-none mt-1">From {cart.restaurantName}</p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Subtotal</p>
                <p className="text-lg font-black text-amber-950 leading-none mt-0.5">{formatCurrency(cartSubtotal)}</p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => setShowCartSummary(!showCartSummary)}
                  variant="outline"
                  className="rounded-xl border-amber-200 text-amber-900 font-bold text-xs uppercase tracking-wider h-11"
                >
                  View Details
                </Button>
                
                <Link href="/foods/checkout">
                  <Button className="bg-amber-500 hover:bg-amber-600 text-amber-950 rounded-xl font-black text-xs uppercase tracking-widest px-6 h-11 shadow-md shadow-amber-500/20 border border-amber-600/10">
                    Proceed to Checkout
                  </Button>
                </Link>
              </div>
            </div>

            {/* Cart Detail Modal/Overlay inside the sticky bottom */}
            {showCartSummary && (
              <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 flex items-end justify-center p-4">
                <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-6 space-y-6 shadow-2xl relative animate-in slide-in-from-bottom duration-300">
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-black text-amber-950 text-lg leading-tight">Your Food Basket</h3>
                      <p className="text-xs font-bold text-amber-600 mt-1">From {cart.restaurantName}</p>
                    </div>
                    <button
                      onClick={() => setShowCartSummary(false)}
                      className="p-1.5 rounded-full hover:bg-amber-50 text-amber-950 transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <hr className="border-amber-100" />

                  {/* List of items */}
                  <div className="max-h-[300px] overflow-y-auto space-y-4 pr-1">
                    {cart.items.map((item) => (
                      <div key={item.foodItemId} className="flex items-center justify-between gap-4 text-sm">
                        <div className="flex items-center gap-3">
                          <span className={`inline-block h-2.5 w-2.5 border rounded-full shrink-0 ${
                            item.isVeg ? "bg-emerald-500 border-emerald-500" : "bg-rose-500 border-rose-500"
                          }`} />
                          <div>
                            <p className="font-bold text-amber-950">{item.name}</p>
                            <p className="text-xs text-amber-900/50 font-bold">{formatCurrency(item.price)} each</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="flex items-center border border-amber-200 rounded-lg p-0.5 bg-amber-50">
                            <button
                              onClick={() => handleAddToCart({ id: item.foodItemId, name: item.name, price: item.price, image: item.image, isVeg: item.isVeg, category: item.category, description: null, averageRating: 0, totalReviews: 0 }, -1)}
                              className="p-1 rounded text-amber-700 hover:bg-white hover:text-amber-950"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="px-2 font-black text-amber-950 text-[11px]">{item.quantity}</span>
                            <button
                              onClick={() => handleAddToCart({ id: item.foodItemId, name: item.name, price: item.price, image: item.image, isVeg: item.isVeg, category: item.category, description: null, averageRating: 0, totalReviews: 0 }, 1)}
                              className="p-1 rounded text-amber-700 hover:bg-white hover:text-amber-950"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>

                          <span className="font-black text-amber-950 min-w-[60px] text-right">
                            {formatCurrency(item.price * item.quantity)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <hr className="border-amber-100" />

                  {/* Summary Totals */}
                  <div className="flex justify-between items-end">
                    <span className="font-bold text-amber-900/60 text-xs uppercase tracking-wider">Subtotal</span>
                    <span className="text-2xl font-black text-amber-950 leading-none">{formatCurrency(cartSubtotal)}</span>
                  </div>

                  <Link href="/foods/checkout" className="block w-full">
                    <Button className="w-full bg-amber-500 hover:bg-amber-600 text-amber-950 rounded-2xl font-black text-xs uppercase tracking-widest h-12 shadow-lg shadow-amber-500/20 border border-amber-600/10">
                      Proceed to Checkout
                    </Button>
                  </Link>

                </div>
              </div>
            )}
          </div>
        )}

        {/* Cross-restaurant Conflict Warning Dialog */}
        <Dialog open={conflictOpen} onOpenChange={setConflictOpen}>
          <DialogContent className="rounded-[2.5rem] max-w-md p-6 border border-amber-100">
            <DialogHeader className="space-y-3">
              <div className="mx-auto h-12 w-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <DialogTitle className="text-center font-black text-amber-950">Replace Basket Items?</DialogTitle>
              <DialogDescription className="text-center text-amber-900/70 font-semibold text-xs leading-relaxed">
                Your basket contains items from <span className="text-amber-950 font-bold">"{cart?.restaurantName}"</span>. Do you want to discard these items and add items from <span className="text-amber-950 font-bold">"{restaurant.businessName}"</span> instead?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="grid grid-cols-2 gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setConflictOpen(false)
                  setConflictItem(null)
                }}
                className="rounded-xl border-amber-200 font-bold text-xs uppercase tracking-widest text-amber-900"
              >
                Cancel
              </Button>
              <Button
                onClick={handleResolveConflict}
                className="bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest"
              >
                Discard &amp; Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </PublicLayout>
  )
}
