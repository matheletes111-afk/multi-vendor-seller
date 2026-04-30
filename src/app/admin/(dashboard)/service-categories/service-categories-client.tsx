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
  createdAt?: string;
  _count: { services: number };
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

/** Renders category image with fallback so list page shows thumb even when external URL fails (referrer, CORS, etc.) */
function CategoryImageCell({ image, name }: { image: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const src = image && !failed ? image : null;
  return (
    <div className="relative w-12 h-12 rounded-2xl overflow-hidden bg-muted shadow-inner flex items-center justify-center border border-muted/50 group-hover:scale-105 transition-transform duration-500">
      {src ? (
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <Briefcase className="h-5 w-5 text-muted-foreground/30" />
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
  const [togglingActiveId, setTogglingActiveId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

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

  const handleToggleActive = async (category: ServiceCategory) => {
    const next = !category.isActive;
    setTogglingActiveId(category.id);
    setToggleError(null);
    try {
      const res = await fetch(`/api/admin/service-categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
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
                c.id === category.id ? { ...c, isActive: next } : c
              ),
            }
          : null
      );
      router.refresh();
    } catch (e: any) {
      setToggleError(e.message || "Failed to update");
    } finally {
      setTogglingActiveId(null);
    }
  };

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
      router.push("/admin/service-categories?success=Service category deleted successfully");
    } catch (error: any) {
      router.push(`/admin/service-categories?error=${encodeURIComponent(error.message)}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-foreground">Service Categories</h1>
          <p className="text-muted-foreground mt-2 text-lg font-medium">Manage professional service classifications</p>
        </div>
        {mounted && (
          <Link href="/admin/service-categories/new">
            <Button className="rounded-full px-6 font-medium text-xs h-12 shadow-lg shadow-primary/20 hover:scale-105 transition-all">
              <Plus className="mr-2 h-4 w-4" />
              Add Service Category
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
              <CardTitle className="text-xl font-medium">Service Directory Hierarchy</CardTitle>
              <CardDescription className="text-sm font-medium">Configure commission rates and portfolio visibility</CardDescription>
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
              <PageLoader message="Organizing service matrix…" />
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
                      <TableHead className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">Service Category</TableHead>
                      <TableHead className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">Total Services</TableHead>
                      <TableHead className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">Visibility</TableHead>
                      <TableHead className="text-right pr-8 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">Control</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.categories.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-24 text-center">
                          <Briefcase className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                          <p className="text-muted-foreground font-medium text-xs">No service categories identified</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortByCreatedAtDesc(data.categories).map((category) => (
                        <TableRow key={category.id} className="group transition-all hover:bg-muted/20 border-b border-muted/30">
                          <TableCell className="pl-8">
                            <CategoryImageCell image={category.image} name={category.name} />
                          </TableCell>
                          <TableCell className="font-medium py-5">
                            <div className="flex flex-col">
                              <span className="text-sm line-clamp-1">{category.name}</span>
                              <span className="text-[10px] text-muted-foreground/60 font-medium line-clamp-1 italic">{category.description || "Service niche description pending"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 font-medium text-sm text-foreground/80">
                              <Briefcase className="h-3.5 w-3.5 text-indigo-500/70" />
                              {category._count.services}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              className={cn(
                                "rounded-full text-[9px] font-medium uppercase tracking-widest px-3 py-0.5 border-none shadow-sm shadow-black/5 cursor-pointer hover:opacity-80 transition-opacity",
                                category.isActive ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                              )}
                              onClick={() => !togglingActiveId && handleToggleActive(category)}
                            >
                              {togglingActiveId === category.id ? "..." : category.isActive ? "Live" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right pr-8">
                            <div className="flex justify-end gap-2 transition-all duration-300">
                              <Link href={`/admin/service-categories/${category.id}/edit?page=${page}&perPage=${perPage}`}>
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
                                      category._count.services > 0 && "opacity-30 cursor-not-allowed"
                                    )}
                                    disabled={category._count.services > 0}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="rounded-3xl border-none shadow-2xl">
                                  <DialogHeader>
                                    <DialogTitle className="text-2xl font-medium">Archive Service Niche</DialogTitle>
                                    <DialogDescription className="text-base font-medium pt-2">
                                      {category._count.services > 0 ? (
                                        <>
                                          Cannot delete &quot;<span className="text-foreground font-medium">{category.name}</span>&quot; because it has{" "}
                                          <Badge className="bg-primary">{category._count.services}</Badge> active service listings.
                                        </>
                                      ) : (
                                        <>
                                          Are you sure you want to permanently remove &quot;<span className="text-foreground font-medium">{category.name}</span>&quot;? This action is irreversible.
                                        </>
                                      )}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <DialogFooter className="gap-2 sm:gap-0 mt-6">
                                    <DialogTrigger asChild>
                                      <Button variant="outline" className="rounded-full px-6 font-medium uppercase tracking-widest text-[10px]">Cancel</Button>
                                    </DialogTrigger>
                                    {category._count.services === 0 && (
                                        <Button
                                          variant="destructive"
                                          className="rounded-full px-6 font-medium uppercase tracking-widest text-[10px] shadow-lg shadow-destructive/20"
                                        onClick={() => handleDelete(category.id)}
                                        disabled={deletingId === category.id}
                                      >
                                        {deletingId === category.id ? "Archiving..." : "Confirm Removal"}
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
