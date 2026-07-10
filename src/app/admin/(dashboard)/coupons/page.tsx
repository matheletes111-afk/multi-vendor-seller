"use client"

import { useState, useEffect } from "react"
import { Plus, Edit, Trash2, Calendar, Search, CheckCircle, XCircle, Tag, Ticket, Percent } from "lucide-react"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Separator } from "@/ui/separator"

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitLoading, setIsSubmitLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [discountType, setDiscountType] = useState("PERCENTAGE")
  const [discountValue, setDiscountValue] = useState("")
  const [type, setType] = useState("PRODUCT")
  const [categoryId, setCategoryId] = useState("")
  const [customerCount, setCustomerCount] = useState("")
  const [maxUsesPerCustomer, setMaxUsesPerCustomer] = useState("1")
  const [minOrderValue, setMinOrderValue] = useState("0")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [isActive, setIsActive] = useState(true)

  // Categories lists
  const [productCategories, setProductCategories] = useState<any[]>([])
  const [serviceCategories, setServiceCategories] = useState<any[]>([])

  const fetchCoupons = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/admin/coupons")
      const data = await res.json()
      if (data.coupons) {
        setCoupons(data.coupons)
      }
    } catch (error) {
      console.error("Error loading coupons:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const prodRes = await fetch("/api/categories")
      const prodData = await prodRes.json()
      // Web might return categories directly as array or in categories key
      if (Array.isArray(prodData)) setProductCategories(prodData)
      else if (prodData.categories) setProductCategories(prodData.categories)

      const servRes = await fetch("/api/service-categories")
      const servData = await servRes.json()
      if (Array.isArray(servData)) setServiceCategories(servData)
      else if (servData.categories) setServiceCategories(servData.categories)
    } catch (e) {
      console.error("Failed to load categories for selector:", e)
    }
  }

  useEffect(() => {
    fetchCoupons()
    fetchCategories()
  }, [])

  const resetForm = () => {
    setEditingId(null)
    setCode("")
    setDiscountType("PERCENTAGE")
    setDiscountValue("")
    setType("PRODUCT")
    setCategoryId("")
    setCustomerCount("")
    setMaxUsesPerCustomer("1")
    setMinOrderValue("0")
    setStartDate("")
    setEndDate("")
    setIsActive(true)
  }

  const handleOpenCreateModal = () => {
    resetForm()
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (coupon: any) => {
    setEditingId(coupon.id)
    setCode(coupon.code)
    setDiscountType(coupon.discountType)
    setDiscountValue(coupon.discountValue.toString())
    setType(coupon.type)
    setCategoryId(coupon.categoryId || "")
    setCustomerCount(coupon.customerCount ? coupon.customerCount.toString() : "")
    setMaxUsesPerCustomer(coupon.maxUsesPerCustomer.toString())
    setMinOrderValue(coupon.minOrderValue.toString())
    setStartDate(new Date(coupon.startDate).toISOString().split("T")[0])
    setEndDate(new Date(coupon.endDate).toISOString().split("T")[0])
    setIsActive(coupon.isActive)
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitLoading(true)

    const payload = {
      code,
      discountType,
      discountValue: parseFloat(discountValue),
      type,
      categoryId: categoryId || null,
      customerCount: customerCount ? parseInt(customerCount) : null,
      maxUsesPerCustomer: parseInt(maxUsesPerCustomer),
      minOrderValue: parseFloat(minOrderValue),
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      isActive
    }

    try {
      const url = editingId ? `/api/admin/coupons/${editingId}` : "/api/admin/coupons"
      const method = editingId ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (res.ok) {
        alert(editingId ? "Coupon updated successfully" : "Coupon created successfully")
        setIsModalOpen(false)
        resetForm()
        fetchCoupons()
      } else {
        alert(data.error || "Something went wrong")
      }
    } catch (error) {
      console.error(error)
      alert("Network request failed")
    } finally {
      setIsSubmitLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this coupon?")) return
    try {
      const res = await fetch(`/api/admin/coupons/${id}`, { method: "DELETE" })
      if (res.ok) {
        alert("Coupon deleted successfully")
        fetchCoupons()
      } else {
        const data = await res.json()
        alert(data.error || "Failed to delete coupon")
      }
    } catch (e) {
      alert("Failed to delete coupon")
    }
  }

  const filteredCoupons = coupons.filter(c =>
    c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.type.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const activeCategoryList = type === "PRODUCT" ? productCategories : type === "SERVICE" ? serviceCategories : []

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Ticket className="h-6 w-6 text-blue-600" />
            Coupon Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Create, update, and manage discount coupons for products, services, hotels, and foods.
          </p>
        </div>
        <Button onClick={handleOpenCreateModal} className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 rounded-xl py-2.5 px-4 shadow-sm">
          <Plus className="h-4 w-4" />
          Create Coupon
        </Button>
      </div>

      <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
        <Search className="h-5 w-5 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Search coupons by code or type..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent border-0 outline-none text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400"
        />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500">Loading coupons...</div>
        ) : filteredCoupons.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Tag className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            No coupons found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  <th className="px-6 py-4">Code</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Discount</th>
                  <th className="px-6 py-4">Min Order</th>
                  <th className="px-6 py-4">Validity</th>
                  <th className="px-6 py-4">Usages</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm text-slate-700 dark:text-slate-300">
                {filteredCoupons.map((coupon) => {
                  const now = new Date()
                  const isExpired = new Date(coupon.endDate) < now
                  const isUpcoming = new Date(coupon.startDate) > now
                  const usageCount = coupon.usages?.length || 0
                  const limitReached = coupon.customerCount !== null && usageCount >= coupon.customerCount
                  const isFullyActive = coupon.isActive && !isExpired && !limitReached

                  return (
                    <tr key={coupon.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-950 dark:text-white">
                        <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-md text-xs border border-blue-100 dark:border-blue-800/50 font-mono">
                          {coupon.code}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="capitalize px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-800 font-medium">
                          {coupon.type.toLowerCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-emerald-600 dark:text-emerald-400">
                        {coupon.discountType === "PERCENTAGE" ? (
                          <span className="flex items-center gap-0.5"><Percent className="h-3.5 w-3.5" />{coupon.discountValue}%</span>
                        ) : (
                          <span className="flex items-center gap-0.5">Nle {coupon.discountValue}</span>
                        )}
                      </td>


                      <td className="px-6 py-4 font-medium">Nle {coupon.minOrderValue}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col text-xs text-slate-500">
                          <span>Start: {new Date(coupon.startDate).toLocaleDateString()}</span>
                          <span>End: {new Date(coupon.endDate).toLocaleDateString()}</span>
                          {isUpcoming && <span className="text-amber-600 font-bold">Upcoming</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <span className={limitReached ? "text-rose-600 font-bold" : ""}>
                          {usageCount} / {coupon.customerCount ?? "∞"}
                        </span>
                        {coupon.maxUsesPerCustomer > 1 && (
                          <span className="block text-slate-400">(Max {coupon.maxUsesPerCustomer} per user)</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${isFullyActive
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                            : limitReached
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400"
                          }`}>
                          {isFullyActive ? (
                            <>
                              <CheckCircle className="h-3.5 w-3.5" />
                              Active
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3.5 w-3.5" />
                              {!coupon.isActive ? "Inactive" : isExpired ? "Expired" : "Limit Reached"}
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenEditModal(coupon)} className="text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(coupon.id)} className="text-slate-600 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden my-8">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-950 dark:white flex items-center gap-2">
                <Ticket className="h-5 w-5 text-blue-600" />
                {editingId ? "Edit Coupon" : "Create Coupon"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {!editingId && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Coupon Code</label>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. SAVE20"
                    required
                    className="rounded-xl border-slate-200 dark:border-slate-800 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Domain Type</label>
                  <select
                    value={type}
                    onChange={(e) => {
                      setType(e.target.value)
                      setCategoryId("") // Reset category on type switch
                    }}
                    className="w-full bg-background border border-input rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="PRODUCT">Products</option>
                    <option value="SERVICE">Services</option>
                    <option value="HOTEL">Hotels</option>
                    <option value="FOOD">Foods</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Discount Type</label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value)}
                    className="w-full bg-background border border-input rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED">Fixed Amount (Nle)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Discount Value</label>
                  <Input
                    type="number"
                    step="any"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder={discountType === "PERCENTAGE" ? "20" : "50"}
                    required
                    className="rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Min Order Value</label>
                  <Input
                    type="number"
                    step="any"
                    value={minOrderValue}
                    onChange={(e) => setMinOrderValue(e.target.value)}
                    placeholder="0"
                    className="rounded-xl"
                  />
                </div>
              </div>

              {(type === "PRODUCT" || type === "SERVICE") && activeCategoryList.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Restrict to Category (Optional)</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full bg-background border border-input rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">All Categories</option>
                    {activeCategoryList.map((cat: any) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Max Global Customer Limit</label>
                  <Input
                    type="number"
                    value={customerCount}
                    onChange={(e) => setCustomerCount(e.target.value)}
                    placeholder="Unlimited"
                    className="rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Max Uses Per Customer</label>
                  <Input
                    type="number"
                    value={maxUsesPerCustomer}
                    onChange={(e) => setMaxUsesPerCustomer(e.target.value)}
                    placeholder="1"
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Start Date</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">End Date</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500 border-slate-300"
                />
                <label htmlFor="isActive" className="text-sm text-slate-700 dark:text-slate-300 select-none">Make this coupon active immediately</label>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 -mx-6 -mb-6 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitLoading} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
                  {isSubmitLoading ? "Saving..." : editingId ? "Save Changes" : "Create Coupon"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
