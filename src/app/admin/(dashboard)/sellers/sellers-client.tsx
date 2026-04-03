"use client"

import { Fragment, useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/ui/button"
import { cn } from "@/lib/utils"
import { buildAdminPageUrl } from "@/lib/admin-pagination"
import { Badge } from "@/ui/badge"
import { Eye } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { PageLoader } from "@/components/ui/page-loader"
import { Alert, AlertDescription } from "@/ui/alert"

export function SellersClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "10", 10) || 10))
  const tab = searchParams.get("tab") ?? "all"

  const [data, setData] = useState<{
    sellers: any[]
    totalCount: number
    totalPages: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [expandedSellerId, setExpandedSellerId] = useState<string | null>(null)

  const successParam = searchParams.get("success")
  const errorParam = searchParams.get("error")

  const loadSellers = useCallback(
    (opts?: { showLoading?: boolean }) => {
      const showLoading = opts?.showLoading !== false
      if (showLoading) {
        setLoading(true)
        setError(null)
      }
      const tabQs = tab === "all" ? "" : `&tab=${encodeURIComponent(tab)}`
      return fetch(`/api/admin/sellers?page=${page}&perPage=${perPage}${tabQs}`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch sellers")
          return res.json()
        })
        .then((json) => {
          setData(json)
        })
        .catch((e) => {
          setError(e.message)
        })
        .finally(() => {
          if (showLoading) setLoading(false)
        })
    },
    [page, perPage, tab]
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const tabQs = tab === "all" ? "" : `&tab=${encodeURIComponent(tab)}`
    fetch(`/api/admin/sellers?page=${page}&perPage=${perPage}${tabQs}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch sellers")
        return res.json()
      })
      .then((json) => {
        if (!cancelled) setData(json)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [page, perPage, tab])

  const handleApprove = async (sellerId: string) => {
    setActionLoading(sellerId)
    try {
      const res = await fetch(`/api/admin/sellers/${sellerId}/approve`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed")
      await loadSellers({ showLoading: false })
      router.push("/admin/sellers?success=approved")
      router.refresh()
    } catch (e: any) {
      router.push(`/admin/sellers?error=${encodeURIComponent(e.message)}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleSuspend = async (sellerId: string) => {
    setActionLoading(sellerId)
    try {
      const res = await fetch(`/api/admin/sellers/${sellerId}/suspend`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed")
      await loadSellers({ showLoading: false })
      router.push("/admin/sellers?success=suspended")
      router.refresh()
    } catch (e: any) {
      router.push(`/admin/sellers?error=${encodeURIComponent(e.message)}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleUnsuspend = async (sellerId: string) => {
    setActionLoading(sellerId)
    try {
      const res = await fetch(`/api/admin/sellers/${sellerId}/unsuspend`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed")
      await loadSellers({ showLoading: false })
      router.push("/admin/sellers?success=unsuspended")
      router.refresh()
    } catch (e: any) {
      router.push(`/admin/sellers?error=${encodeURIComponent(e.message)}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleAdminAction = async (sellerId: string, action: string, feedback?: string) => {
    setActionLoading(sellerId)
    try {
      const res = await fetch(`/api/admin/sellers/${sellerId}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, feedback })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed")
      await loadSellers({ showLoading: false })
      router.push(`/admin/sellers?success=${action}_success`)
      router.refresh()
    } catch (e: any) {
      router.push(`/admin/sellers?error=${encodeURIComponent(e.message)}`)
    } finally {
      setActionLoading(null)
    }
  }

  const params = {
    error: errorParam ?? undefined,
    success: successParam ?? undefined,
    tab: tab === "all" ? undefined : tab,
  }

  const sellerTabs = [
    { id: "all", label: "All" },
    { id: "pending", label: "Pending approval" },
    { id: "approved", label: "Approved" },
    { id: "suspended", label: "Suspended" },
  ] as const

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Manage Sellers</h1>
        <p className="text-muted-foreground mt-2">View and manage all sellers on the platform</p>
      </div>

      {params.error && (
        <Alert variant="destructive">
          <AlertDescription>{decodeURIComponent(params.error)}</AlertDescription>
        </Alert>
      )}
      {params.success && (
        <Alert>
          <AlertDescription>{params.success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Seller list</CardTitle>
          <CardDescription>All sellers with store, type, status and subscription</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 pb-4 mb-4 border-b">
            {sellerTabs.map((t) => (
              <Link
                key={t.id}
                href={buildAdminPageUrl("/admin/sellers", 1, {
                  error: params.error,
                  success: params.success,
                  tab: t.id === "all" ? undefined : t.id,
                })}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  tab === t.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {t.label}
              </Link>
            ))}
          </div>
          {loading ? (
            <PageLoader message="Loading sellers…" />
          ) : error ? (
            <div className="py-12 text-center text-destructive">{error}</div>
          ) : !data ? null : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Seller</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Subscription</TableHead>
                    <TableHead>Stats</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.sellers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No sellers found
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.sellers.map((seller: any) => (
                      <Fragment key={seller.id}>
                        <TableRow>
                          <TableCell className="font-medium">
                            {seller.user?.name || seller.user?.email}
                          </TableCell>
                          <TableCell>{seller.store?.name || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{seller.type}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge variant={seller.isApproved ? "default" : "outline"}>
                                {seller.isApproved ? "Approved" : "Pending"}
                              </Badge>
                              {seller.isSuspended && (
                                <Badge variant="destructive">Suspended</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {seller.subscription?.plan?.displayName ?? (
                              <span className="text-muted-foreground">None</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {seller._count?.products ?? 0} products • {seller._count?.services ?? 0} services •{" "}
                              {seller._count?.orders ?? 0} orders
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setExpandedSellerId((prev) => (prev === seller.id ? null : seller.id))
                                }
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                {expandedSellerId === seller.id ? "Hide details" : "View details"}
                              </Button>
                              {!seller.isApproved && (
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={actionLoading === seller.id}
                                  onClick={() => handleApprove(seller.id)}
                                >
                                  Approve
                                </Button>
                              )}
                              {seller.isSuspended ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={actionLoading === seller.id}
                                  onClick={() => handleUnsuspend(seller.id)}
                                >
                                  Unsuspend
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  disabled={actionLoading === seller.id}
                                  onClick={() => handleSuspend(seller.id)}
                                >
                                  Suspend
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>

                        {expandedSellerId === seller.id && (
                          <TableRow>
                            <TableCell colSpan={7}>
                              <div className="p-4">
                                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                  <div className="space-y-4">
                                    <div className="font-bold border-b pb-1">Basic & Store</div>
                                    <div className="text-sm space-y-1">
                                      <div><span className="text-muted-foreground mr-2">Email:</span>{seller.user?.email}</div>
                                      <div><span className="text-muted-foreground mr-2">Phone:</span>{seller.user?.phoneCountryCode} {seller.user?.phone}</div>
                                      <div><span className="text-muted-foreground mr-2">Store:</span>{seller.store?.name}</div>
                                      <div><span className="text-muted-foreground mr-2">NIN:</span>{seller.nationIdentityNumber || "—"}</div>
                                    </div>
                                    <div className="font-bold border-b pb-1 pt-2">Authorized Categories</div>
                                    <div className="flex flex-wrap gap-1">
                                       {(seller.type === "PRODUCT" ? seller.selectedCategories : seller.selectedServiceCategories)?.map((c: any) => (
                                           <Badge key={c.id} variant="outline" className="text-[10px]">{c.name}</Badge>
                                       )) || <span className="text-xs text-muted-foreground">None selected</span>}
                                    </div>
                                  </div>

                                  <div className="space-y-4">
                                    <div className="font-bold border-b pb-1">Business Information</div>
                                    <div className="text-sm space-y-1">
                                      <div><span className="text-muted-foreground mr-2">Name:</span>{seller.businessInfo?.businessName || "—"}</div>
                                      <div><span className="text-muted-foreground mr-2">Type:</span>{seller.businessInfo?.businessType || "—"}</div>
                                      <div><span className="text-muted-foreground mr-2">Reg No:</span>{seller.businessInfo?.businessRegNumber || "—"}</div>
                                      <div><span className="text-muted-foreground mr-2">TIN:</span>{seller.businessInfo?.taxIdNumber || "—"}</div>
                                      <div><span className="text-muted-foreground mr-2">Address:</span>{seller.businessInfo?.street}, {seller.businessInfo?.city}</div>
                                    </div>
                                    {seller.businessInfo?.busRegCertUrl && (
                                        <a href={seller.businessInfo.busRegCertUrl} target="_blank" className="text-xs text-primary underline flex items-center gap-1">
                                            View Registration Certificate
                                        </a>
                                    )}
                                  </div>

                                  <div className="space-y-4">
                                    <div className="font-bold border-b pb-1">KYC & Identity</div>
                                    <div className="text-sm space-y-1">
                                      <div><span className="text-muted-foreground mr-2">ID Type:</span>{seller.kyc?.idType || "—"}</div>
                                      <div><span className="text-muted-foreground mr-2">ID No:</span>{seller.kyc?.idNumber || "—"}</div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                       {seller.kyc?.idFrontUrl && (
                                           <div className="space-y-1">
                                               <span className="text-[10px] text-muted-foreground">ID Front</span>
                                               <img src={seller.kyc.idFrontUrl} className="h-16 w-full object-cover border rounded cursor-pointer" onClick={() => window.open(seller.kyc.idFrontUrl)} />
                                           </div>
                                       )}
                                       {seller.kyc?.idBackUrl && (
                                            <div className="space-y-1">
                                                <span className="text-[10px] text-muted-foreground">ID Back</span>
                                                <img src={seller.kyc.idBackUrl} className="h-16 w-full object-cover border rounded cursor-pointer" onClick={() => window.open(seller.kyc.idBackUrl)} />
                                            </div>
                                       )}
                                       {seller.kyc?.selfieUrl && (
                                            <div className="space-y-1 col-span-2">
                                                <span className="text-[10px] text-muted-foreground">Selfie</span>
                                                <img src={seller.kyc.selfieUrl} className="h-24 w-24 object-cover border rounded mx-auto cursor-pointer" onClick={() => window.open(seller.kyc.selfieUrl)} />
                                            </div>
                                       )}
                                    </div>
                                  </div>

                                  <div className="space-y-4 lg:col-span-3 grid md:grid-cols-2 bg-muted/30 p-4 rounded-lg">
                                     <div>
                                        <div className="font-bold border-b pb-1 mb-2">Bank Details</div>
                                        <div className="text-sm space-y-1">
                                            <div><span className="text-muted-foreground mr-2">Bank:</span>{seller.bankDetails?.bankName}</div>
                                            <div><span className="text-muted-foreground mr-2">Holdr:</span>{seller.bankDetails?.accountHolderName}</div>
                                            <div><span className="text-muted-foreground mr-2">Acc No:</span>{seller.bankDetails?.accountNumber}</div>
                                            <div><span className="text-muted-foreground mr-2">Payout:</span>{seller.bankDetails?.preferredPayoutMethod}</div>
                                        </div>
                                     </div>
                                     <div className="flex flex-col justify-end gap-2 items-end">
                                        <div className="text-xs text-muted-foreground italic mb-2">Admin Review Actions</div>
                                        <div className="flex gap-2">
                                            {!seller.isApproved && (
                                                <>
                                                    <Button size="sm" variant="outline" className="text-yellow-600 border-yellow-600 hover:bg-yellow-50" onClick={() => {
                                                        const msg = prompt("Enter feedback for correction:");
                                                        if (msg) handleAdminAction(seller.id, "correction", msg);
                                                    }}>Need Correction</Button>
                                                    <Button size="sm" variant="destructive" onClick={() => {
                                                        if (confirm("Reject this seller account?")) handleAdminAction(seller.id, "reject");
                                                    }}>Reject</Button>
                                                </>
                                            )}
                                        </div>
                                     </div>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))
                  )}
                </TableBody>
              </Table>
              <AdminPagination
                basePath="/admin/sellers"
                currentPage={page}
                totalPages={data.totalPages}
                totalCount={data.totalCount}
                pageSize={perPage}
                params={params}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
