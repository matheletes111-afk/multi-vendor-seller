"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { Alert, AlertDescription } from "@/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/ui/dialog";
import { Plus, Pencil, Trash2, Eye, EyeOff, Tag, Calendar } from "lucide-react";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { PageLoader } from "@/components/ui/page-loader";
import { cn } from "@/lib/utils";

interface Banner {
  id: string;
  bannerHeading: string;
  bannerDescription: string | null;
  bannerImage: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  targetType: string | null;
  category: { id: string; name: string } | null;
  subcategory: { id: string; name: string; category: { name: string } } | null;
  serviceCategory: { id: string; name: string } | null;
}

export function BannersClient() {
  const searchParams = useSearchParams();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "10", 10) || 10));
  const params = {
    error: searchParams.get("error") ?? undefined,
    success: searchParams.get("success") ?? undefined,
  };

  const [data, setData] = useState<{
    banners: Banner[];
    totalCount: number;
    totalPages: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const refetchBanners = () => {
    return fetch(`/api/admin/banners?page=${page}&perPage=${perPage}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch banners");
        return res.json();
      })
      .then((json) => setData(json));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    fetch(`/api/admin/banners?page=${page}&perPage=${perPage}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch banners");
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((e) => {
        if (!cancelled) setFetchError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, perPage]);

  const handleImageError = (id: string) => {
    setImageErrors((prev) => new Set(prev).add(id));
  };

  const handleDelete = async (bannerId: string) => {
    setDeletingId(bannerId);
    try {
      const response = await fetch(`/api/admin/banners/${bannerId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete banner");
      }
      window.location.href = "/admin/banners?success=Banner deleted successfully";
    } catch (error: any) {
      window.location.href = `/admin/banners?error=${encodeURIComponent(error.message)}`;
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleStatus = async (bannerId: string, currentStatus: boolean) => {
    setTogglingId(bannerId);
    try {
      const response = await fetch(`/api/admin/banners/${bannerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "Failed to update banner status");
      }
      await refetchBanners();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setTogglingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-foreground">Banner Management</h1>
          <p className="text-muted-foreground mt-2 text-lg font-medium">Curate promotional real estate for all categories</p>
        </div>
        {mounted && (
          <Link href="/admin/banners/new">
            <Button className="rounded-full px-6 font-medium text-xs h-12 shadow-lg shadow-primary/20 hover:scale-105 transition-all">
              <Plus className="mr-2 h-4 w-4" />
              Add New Banner
            </Button>
          </Link>
        )}
      </div>

      {params.error && (
        <Alert variant="destructive" className="border-none shadow-xl bg-destructive/10 text-destructive animate-in slide-in-from-top-4 duration-500">
          <AlertDescription className="font-medium">{decodeURIComponent(params.error)}</AlertDescription>
        </Alert>
      )}
      {params.success && (
        <Alert className="border-none shadow-xl bg-green-500/10 text-green-600 animate-in slide-in-from-top-4 duration-500">
          <AlertDescription className="font-medium text-xs">Action completed: {decodeURIComponent(params.success)}</AlertDescription>
        </Alert>
      )}

      <Card className="border-none shadow-2xl overflow-hidden rounded-3xl bg-gradient-to-br from-background via-background to-muted/20">
        <CardHeader className="pb-4 border-b border-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-medium">Promotion Inventory</CardTitle>
              <CardDescription className="text-sm font-medium">Monitor active banner slots and performance targeting</CardDescription>
            </div>
            {data && (
              <Badge variant="outline" className="px-4 py-1 font-medium rounded-full shadow-sm bg-background border-primary/20 text-primary">
                {data.totalCount} Banners
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="py-32">
              <PageLoader message="Rendering visual inventory…" />
            </div>
          ) : fetchError ? (
            <div className="py-24 text-center">
              <p className="text-destructive font-medium">{fetchError}</p>
            </div>
          ) : !data ? null : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40 transition-none">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="py-5 pl-8 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">Visual</TableHead>
                      <TableHead className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">Message & Details</TableHead>
                      <TableHead className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">Targeting</TableHead>
                      <TableHead className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">Standing</TableHead>
                      <TableHead className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">Timeline</TableHead>
                      <TableHead className="text-right pr-8 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">Control</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.banners.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-24 text-center">
                          <Plus className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                          <p className="text-muted-foreground font-medium text-xs">No promotional banners identified</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.banners.map((banner) => (
                        <TableRow key={banner.id} className="group transition-all hover:bg-muted/20 border-b border-muted/30">
                          <TableCell className="pl-8">
                            {banner.bannerImage && !imageErrors.has(banner.id) ? (
                              <div className="relative w-24 h-14 rounded-2xl overflow-hidden bg-muted shadow-lg border border-muted/50 transition-transform group-hover:scale-105 duration-500">
                                <img
                                  src={banner.bannerImage}
                                  alt={banner.bannerHeading}
                                  className="w-full h-full object-cover"
                                  onError={() => handleImageError(banner.id)}
                                />
                              </div>
                            ) : (
                              <div className="w-24 h-14 rounded-2xl bg-muted/50 flex items-center justify-center border-2 border-dashed border-muted">
                                <Plus className="h-5 w-5 text-muted-foreground/30" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="py-5">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium truncate max-w-[200px]">{banner.bannerHeading}</span>
                              <span className="text-[10px] text-muted-foreground/60 italic line-clamp-1 max-w-[200px]">{banner.bannerDescription || "No description provided"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-indigo-500/10 rounded-lg">
                                <Tag className={cn("h-3.5 w-3.5", banner.serviceCategory || banner.targetType === "service" ? "text-indigo-600" : "text-emerald-600")} />
                              </div>
                              <span className="text-xs font-medium text-foreground/80 lowercase italic whitespace-nowrap">
                                {banner.serviceCategory
                                  ? banner.serviceCategory.name
                                  : banner.category
                                  ? banner.category.name
                                  : banner.subcategory
                                  ? banner.subcategory.name
                                  : banner.targetType || "global"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn(
                              "rounded-full text-[9px] font-medium uppercase tracking-widest px-3 py-0.5 border-none shadow-sm shadow-black/5",
                              banner.isActive ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                            )}>
                              {banner.isActive ? "Live" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-muted-foreground/80">
                              <Calendar className="h-3 w-3" />
                              <span className="text-[10px] font-medium">{formatDate(banner.createdAt)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right pr-8">
                            <div className="flex justify-end gap-2 transition-all duration-300">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                                onClick={() => handleToggleStatus(banner.id, banner.isActive)}
                                disabled={togglingId === banner.id}
                              >
                                {togglingId === banner.id ? (
                                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                ) : banner.isActive ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                              <Link href={`/admin/banners/${banner.id}/edit`}>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="rounded-3xl border-none shadow-2xl">
                                  <DialogHeader>
                                    <DialogTitle className="text-2xl font-medium">Teardown Banner</DialogTitle>
                                    <DialogDescription className="text-base font-medium pt-2">
                                      Are you sure you want to permanently delete &quot;<span className="text-foreground font-medium">{banner.bannerHeading}</span>&quot;? This action will immediately remove it from all assigned inventory slots.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <DialogFooter className="gap-2 sm:gap-0 mt-6">
                                    <DialogTrigger asChild>
                                      <Button variant="outline" className="rounded-full px-6 font-medium uppercase tracking-widest text-[10px]">Cancel</Button>
                                    </DialogTrigger>
                                      <Button
                                        variant="destructive"
                                        className="rounded-full px-6 font-medium uppercase tracking-widest text-[10px] shadow-lg shadow-destructive/20"
                                      onClick={() => handleDelete(banner.id)}
                                      disabled={deletingId === banner.id}
                                    >
                                      {deletingId === banner.id ? "Deleting..." : "Confirm Removal"}
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="p-8 bg-muted/10 border-t border-muted/20 rounded-b-3xl">
                <AdminPagination
                  basePath="/admin/banners"
                  currentPage={page}
                  totalPages={data.totalPages}
                  totalCount={data.totalCount}
                  pageSize={perPage}
                  params={params}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

