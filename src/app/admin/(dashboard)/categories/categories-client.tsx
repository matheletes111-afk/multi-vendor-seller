"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  const params = {
    error: searchParams.get("error") ?? undefined,
    success: searchParams.get("success") ?? undefined,
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
  }, [page, perPage]);

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

      router.refresh();
      router.push("/admin/categories?success=Category deleted successfully");
    } catch (error: any) {
      router.push(`/admin/categories?error=${encodeURIComponent(error.message)}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Product categories</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage categories and subcategories for products</p>
        </div>
        {mounted ? (
          <Link href="/admin/categories/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          </Link>
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

      <Card className="overflow-hidden border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Category list</CardTitle>
          <CardDescription>All product categories with product and subcategory counts</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {loading && !data ? (
            <PageLoader message="Loading categories…" />
          ) : fetchError ? (
            <div className="py-12 text-center text-destructive px-4">{fetchError}</div>
          ) : !data ? null : (
            <>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Description</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Subcategories</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    No categories found
                  </TableCell>
                </TableRow>
              ) : (
                sortByCreatedAtDesc(data.categories).map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      {category.image ? (
                        <div className="relative w-12 h-12 rounded overflow-hidden bg-muted shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={category.image}
                            alt={category.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-muted-foreground text-xs shrink-0">
                          —
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground hidden md:table-cell">
                      {category.description || "—"}
                    </TableCell>
                    <TableCell>{category.commissionRate}%</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Package className="h-4 w-4" />
                        {category._count.products}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <FolderTree className="h-4 w-4" />
                        {category._count.subcategories}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={category.isActive ? "default" : "secondary"}>
                        {category.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/admin/categories/${category.id}/edit?page=${page}&perPage=${perPage}`}>
                          <Button variant="outline" size="sm" className="shrink-0">
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                        </Link>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              title={
                                category._count.products > 0
                                  ? "Cannot delete: this category has products. Remove or reassign them first."
                                  : undefined
                              }
                              className={
                                category._count.products > 0
                                  ? "opacity-60"
                                  : undefined
                              }
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Delete Category</DialogTitle>
                              <DialogDescription>
                                {category._count.products > 0 ? (
                                  <>
                                    Cannot delete &quot;{category.name}&quot; because it has{" "}
                                    <strong>{category._count.products} product(s)</strong>. Remove or reassign them first.
                                  </>
                                ) : (
                                  <>
                                    Are you sure you want to delete &quot;{category.name}&quot;?
                                    {category._count.subcategories > 0 && (
                                      <span className="block mt-2 text-destructive">
                                        This will also delete {category._count.subcategories} subcategory(ies).
                                      </span>
                                    )}{" "}
                                    This cannot be undone.
                                  </>
                                )}
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <DialogTrigger asChild>
                                <Button variant="outline">Cancel</Button>
                              </DialogTrigger>
                              {category._count.products === 0 && (
                                <Button
                                  variant="destructive"
                                  onClick={() => handleDelete(category.id)}
                                  disabled={deletingId === category.id}
                                >
                                  {deletingId === category.id ? "Deleting..." : "Delete"}
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
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-t">
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
