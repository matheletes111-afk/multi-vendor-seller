"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { cn } from "@/lib/utils";
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
import { Plus, Pencil, Trash2, Package, FolderTree } from "lucide-react";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { PageLoader } from "@/components/ui/page-loader";

interface Subcategory {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  isActive: boolean;
  _count?: {
    products: number;
  };
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  commissionRate: number;
  isActive: boolean;
  isFeatured?: boolean;
  createdAt?: string;
  _count: {
    products: number;
    subcategories: number;
  };
  subcategories: Subcategory[];
}

/** Sort by createdAt desc (latest first), then by id for stability. */
function sortByCreatedAtDesc<T extends { id: string; createdAt?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (tb !== ta) return tb - ta;
    return a.id.localeCompare(b.id);
  });
}

export function CategoriesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "10", 10) || 10));
  const errorParam = searchParams.get("error") ?? "";
  const successParam = searchParams.get("success") ?? "";
  const params = {
    error: errorParam || undefined,
    success: successParam || undefined,
  };

  const [data, setData] = useState<{
    categories: Category[];
    totalCount: number;
    totalPages: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingFeaturedId, setTogglingFeaturedId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    fetch(`/api/admin/categories?page=${page}&perPage=${perPage}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch categories");
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
  }, [page, perPage, errorParam, successParam]);

  const handleToggleFeatured = async (category: Category) => {
    const next = !category.isFeatured;
    setTogglingFeaturedId(category.id);
    setToggleError(null);
    try {
      const res = await fetch(`/api/admin/categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFeatured: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToggleError(data.error || "Failed to update");
        return;
      }
      setData((prev) =>
        prev
          ? {
              ...prev,
              categories: prev.categories.map((c) =>
                c.id === category.id ? { ...c, isFeatured: next } : c
              ),
            }
          : null
      );
      router.refresh();
    } catch (e: any) {
      setToggleError(e.message || "Failed to update");
    } finally {
      setTogglingFeaturedId(null);
    }
  };

  const handleDelete = async (categoryId: string) => {
    setDeletingId(categoryId);
    try {
      const response = await fetch(`/api/admin/categories/${categoryId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete category");
      }

      setData((prev) => {
        if (!prev) return prev;
        const nextCategories = prev.categories.filter((c) => c.id !== categoryId);
        return {
          ...prev,
          categories: nextCategories,
          totalCount: Math.max(0, prev.totalCount - 1),
        };
      });

      router.refresh();
      router.push("/admin/categories?success=Category deleted successfully");
    } catch (error: any) {
      router.push(`/admin/categories?error=${encodeURIComponent(error.message)}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-foreground">Product Categories</h1>
          <p className="text-muted-foreground mt-2 text-lg font-medium">Structure and organize your marketplace catalog</p>
        </div>
        {mounted && (
          <Link href="/admin/categories/new">
            <Button className="rounded-full px-6 font-medium text-xs h-12 shadow-lg shadow-primary/20 hover:scale-105 transition-all">
              <Plus className="mr-2 h-4 w-4" />
              Add Category
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
      {toggleError && (
        <Alert variant="destructive" className="border-none shadow-xl bg-destructive/10 text-destructive animate-in slide-in-from-top-4 duration-500">
          <AlertDescription className="font-medium">{toggleError}</AlertDescription>
        </Alert>
      )}

      <Card className="border-none shadow-2xl overflow-hidden rounded-3xl bg-gradient-to-br from-background via-background to-muted/20">
        <CardHeader className="pb-4 border-b border-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-medium">Category Catalog</CardTitle>
              <CardDescription className="text-sm font-medium">Manage visibility, commissions, and hierarchy</CardDescription>
            </div>
            {data && (
              <Badge variant="outline" className="px-4 py-1 font-medium rounded-full shadow-sm bg-background">
                {data.totalCount} Categories
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="py-32">
              <PageLoader message="Organizing categories…" />
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
                      <TableHead className="py-5 pl-8 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">Preview</TableHead>
                      <TableHead className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">Entity Details</TableHead>
                      <TableHead className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">Total Products</TableHead>
                      <TableHead className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">Subcategories</TableHead>
                      <TableHead className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">Visibility</TableHead>
                      <TableHead className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">Featured</TableHead>
                      <TableHead className="text-right pr-8 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">Control</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.categories.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-24 text-center">
                          <FolderTree className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                          <p className="text-muted-foreground font-medium text-xs">No categories found in registry</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortByCreatedAtDesc(data.categories).map((category) => (
                        <TableRow key={category.id} className="group transition-all hover:bg-muted/20 border-b border-muted/30">
                          <TableCell className="pl-8">
                            {category.image ? (
                              <div className="relative w-12 h-12 rounded-2xl overflow-hidden bg-muted shadow-inner group-hover:scale-105 transition-transform duration-500 border border-muted/50">
                                <img
                                  src={category.image}
                                  alt={category.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-12 h-12 rounded-2xl bg-muted/50 border-2 border-dashed border-muted flex items-center justify-center text-muted-foreground/30">
                                <Package className="h-5 w-5" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium py-5">
                            <div className="flex flex-col">
                              <span className="text-sm line-clamp-1">{category.name}</span>
                              <span className="text-[10px] text-muted-foreground/60 font-medium line-clamp-1 italic">{category.description || "No description provided"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 font-medium text-xs text-foreground/80">
                              <Package className="h-3.5 w-3.5 text-orange-500/70" />
                              {category._count.products}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 font-medium text-xs text-foreground/80">
                              <FolderTree className="h-3.5 w-3.5 text-indigo-500/70" />
                              {category._count.subcategories}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn(
                              "rounded-full text-[9px] font-medium uppercase tracking-widest px-3 py-0.5 border-none shadow-sm shadow-black/5",
                              category.isActive ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                            )}>
                              {category.isActive ? "Active" : "Archived"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant={category.isFeatured ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleToggleFeatured(category)}
                              disabled={togglingFeaturedId === category.id}
                              className={cn(
                                "rounded-full h-7 px-4 text-[9px] font-medium uppercase tracking-widest transition-all",
                                category.isFeatured ? "bg-primary shadow-lg shadow-primary/20" : "border-2"
                              )}
                            >
                              {togglingFeaturedId === category.id
                                ? "..."
                                : category.isFeatured
                                  ? "Featured"
                                  : "Promote"}
                            </Button>
                          </TableCell>
                          <TableCell className="text-right pr-8">
                            <div className="flex justify-end gap-2 transition-all duration-300">
                              <Link href={`/admin/categories/${category.id}/edit?page=${page}&perPage=${perPage}`}>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </Link>
                              
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                      "h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive",
                                      category._count.products > 0 && "opacity-30 cursor-not-allowed"
                                    )}
                                    disabled={category._count.products > 0}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="rounded-3xl border-none shadow-2xl">
                                  <DialogHeader>
                                    <DialogTitle className="text-2xl font-medium">Decommission Category</DialogTitle>
                                    <DialogDescription className="text-base font-medium pt-2">
                                      {category._count.products > 0 ? (
                                        <>
                                          Cannot delete &quot;<span className="text-foreground font-medium">{category.name}</span>&quot; because it has{" "}
                                          <Badge className="bg-primary">{category._count.products}</Badge> active products.
                                        </>
                                      ) : (
                                        <>
                                          Are you sure you want to purge &quot;<span className="text-foreground font-medium">{category.name}</span>&quot;?
                                          {category._count.subcategories > 0 && (
                                            <span className="block mt-4 p-3 bg-destructive/10 text-destructive rounded-2xl font-medium border border-destructive/20">
                                              Warning: This will also terminate {category._count.subcategories} subcategories.
                                            </span>
                                          )}
                                        </>
                                      )}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <DialogFooter className="gap-2 sm:gap-0 mt-6">
                                    <DialogTrigger asChild>
                                      <Button variant="outline" className="rounded-full px-6 font-medium uppercase tracking-widest text-[10px]">Cancel</Button>
                                    </DialogTrigger>
                                    {category._count.products === 0 && (
                                        <Button
                                          variant="destructive"
                                          className="rounded-full px-6 font-medium uppercase tracking-widest text-[10px] shadow-lg shadow-destructive/20"
                                        onClick={() => handleDelete(category.id)}
                                        disabled={deletingId === category.id}
                                      >
                                        {deletingId === category.id ? "Processing..." : "Purge Now"}
                                      </Button>
                                    )}
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
                  basePath="/admin/categories"
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
