"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
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
import { Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { AdminPagination } from "@/components/admin/admin-pagination";

interface Banner {
  id: string;
  bannerHeading: string;
  bannerDescription: string | null;
  bannerImage: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string } | null;
  subcategory: { id: string; name: string; category: { name: string } } | null;
}

export function BannersClient() {
  const router = useRouter();
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

  useEffect(() => setMounted(true), []);

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
    try {
      const response = await fetch(`/api/admin/banners/${bannerId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update banner status");
      }

      router.refresh();
    } catch (error: any) {
      alert(error.message);
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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Banner Management</h1>
          <p className="text-muted-foreground mt-2">Create and manage promotional banners</p>
        </div>
        {mounted ? (
          <Link href="/admin/banners/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add New Banner
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

      <Card>
        <CardHeader>
          <CardTitle>Banner list</CardTitle>
          <CardDescription>All banners with targeting and status</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <div className="py-12 text-center text-muted-foreground">Loading...</div>
          ) : fetchError ? (
            <div className="py-12 text-center text-destructive">{fetchError}</div>
          ) : !data ? null : (
            <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Preview</TableHead>
                <TableHead>Heading</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.banners.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    No banners found
                  </TableCell>
                </TableRow>
              ) : (
                data.banners.map((banner) => (
                  <TableRow key={banner.id}>
                    <TableCell>
                      {banner.bannerImage && !imageErrors.has(banner.id) ? (
                        <div className="relative w-20 h-12 rounded overflow-hidden bg-muted shrink-0">
                          <Image
                            src={banner.bannerImage}
                            alt={banner.bannerHeading}
                            fill
                            className="object-cover"
                            onError={() => handleImageError(banner.id)}
                          />
                        </div>
                      ) : (
                        <div className="w-20 h-12 rounded bg-muted flex items-center justify-center text-muted-foreground text-xs">
                          No image
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/banners/${banner.id}/edit`} className="font-medium hover:underline">
                        {banner.bannerHeading}
                      </Link>
                      {banner.bannerDescription && (
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{banner.bannerDescription}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {banner.category
                        ? `Category: ${banner.category.name}`
                        : banner.subcategory
                        ? `Sub: ${banner.subcategory.name} (${banner.subcategory.category.name})`
                        : "All Categories"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={banner.isActive ? "default" : "secondary"}>
                        {banner.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(banner.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleStatus(banner.id, banner.isActive)}
                        >
                          {banner.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Link href={`/admin/banners/${banner.id}/edit`}>
                          <Button variant="outline" size="sm">
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                        </Link>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Delete Banner</DialogTitle>
                              <DialogDescription>
                                Are you sure you want to delete &quot;{banner.bannerHeading}&quot;? This action cannot be
                                undone.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <DialogTrigger asChild>
                                <Button variant="outline">Cancel</Button>
                              </DialogTrigger>
                              <Button
                                variant="destructive"
                                onClick={() => handleDelete(banner.id)}
                                disabled={deletingId === banner.id}
                              >
                                {deletingId === banner.id ? "Deleting..." : "Delete"}
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
          <AdminPagination
            basePath="/admin/banners"
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
  );
}
