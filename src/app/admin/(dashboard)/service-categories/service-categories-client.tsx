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
import { Plus, Pencil, Trash2, Briefcase } from "lucide-react";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { PageLoader } from "@/components/ui/page-loader";

interface ServiceCategory {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  mobileIcon: string | null;
  commissionRate: number;
  isActive: boolean;
  _count: { services: number };
}

/** Renders category image with fallback so list page shows thumb even when external URL fails (referrer, CORS, etc.) */
function CategoryImageCell({ image, name }: { image: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const src = image && !failed ? image : null;
  return (
    <div className="relative w-12 h-12 rounded overflow-hidden bg-muted shrink-0 flex items-center justify-center">
      {src ? (
        /* referrerPolicy helps external CDN images (e.g. Unsplash) load on list page; onError fallback when they don't */
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      )}
    </div>
  );
}

export function ServiceCategoriesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "10", 10) || 10));
  const params = {
    error: searchParams.get("error") ?? undefined,
    success: searchParams.get("success") ?? undefined,
  };

  const [data, setData] = useState<{
    categories: ServiceCategory[];
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
    fetch(`/api/admin/service-categories?page=${page}&perPage=${perPage}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch service categories");
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
      const response = await fetch(`/api/admin/service-categories/${categoryId}`, {
        method: "DELETE",
      });
      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "Failed to delete service category");
      }
      router.refresh();
      router.push("/admin/service-categories?success=Service category deleted successfully");
    } catch (error: any) {
      router.push(`/admin/service-categories?error=${encodeURIComponent(error.message)}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Service categories</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage categories for services (no subcategories)</p>
        </div>
        {mounted ? (
          <Link href="/admin/service-categories/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Service Category
            </Button>
          </Link>
        ) : (
          <div className="h-10 w-[180px] rounded-md bg-muted" />
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
          <CardTitle className="text-lg">Service category list</CardTitle>
          <CardDescription>All service categories with service counts</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {loading && !data ? (
            <PageLoader message="Loading service categories…" />
          ) : fetchError ? (
            <div className="py-12 text-center text-destructive px-4">{fetchError}</div>
          ) : !data ? null : (
            <>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 shrink-0">Image</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden md:table-cell">Description</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Services</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.categories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        No service categories found
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.categories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell>
                          <CategoryImageCell image={category.image} name={category.name} />
                        </TableCell>
                        <TableCell className="font-medium">{category.name}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground hidden md:table-cell">
                          {category.description || "—"}
                        </TableCell>
                        <TableCell>{category.commissionRate}%</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Briefcase className="h-4 w-4" />
                            {category._count.services}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={category.isActive ? "default" : "secondary"}>
                            {category.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2 flex-wrap">
                            <Link href={`/admin/service-categories/${category.id}/edit`}>
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
                                    category._count.services > 0
                                      ? "Cannot delete: this category has services. Remove or reassign them first."
                                      : undefined
                                  }
                                  className={category._count.services > 0 ? "opacity-60" : undefined}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Delete Service Category</DialogTitle>
                                  <DialogDescription>
                                    {category._count.services > 0 ? (
                                      <>
                                        Cannot delete &quot;{category.name}&quot; because it has{" "}
                                        <strong>{category._count.services} service(s)</strong>. Remove or reassign them first.
                                      </>
                                    ) : (
                                      <>
                                        Are you sure you want to delete &quot;{category.name}&quot;? This cannot be undone.
                                      </>
                                    )}
                                  </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                  <DialogTrigger asChild>
                                    <Button variant="outline">Cancel</Button>
                                  </DialogTrigger>
                                  {category._count.services === 0 && (
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
                  basePath="/admin/service-categories"
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
