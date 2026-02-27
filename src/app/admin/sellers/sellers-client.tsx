"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
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
import { Alert, AlertDescription } from "@/ui/alert"

export function SellersClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "10", 10) || 10))

  const [data, setData] = useState<{
    sellers: any[]
    totalCount: number
    totalPages: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/admin/sellers?page=${page}&perPage=${perPage}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch sellers")
        return res.json()
      })
      .then((json) => {
        if (!cancelled) {
          setData(json)
        }
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
  }, [page, perPage])

  const handleApprove = async (sellerId: string) => {
    setActionLoading(sellerId)
    try {
      const res = await fetch(`/api/admin/sellers/${sellerId}/approve`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed")
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
      router.push("/admin/sellers?success=unsuspended")
      router.refresh()
    } catch (e: any) {
      router.push(`/admin/sellers?error=${encodeURIComponent(e.message)}`)
    } finally {
      setActionLoading(null)
    }
  }

  const params = {
    error: searchParams.get("error") ?? undefined,
    success: searchParams.get("success") ?? undefined,
  }

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
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading...</div>
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
                      <TableRow key={seller.id}>
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
                            {seller._count?.products ?? 0} products • {seller._count?.services ?? 0} services • {seller._count?.orders ?? 0} orders
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
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
