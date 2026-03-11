"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { Alert, AlertDescription } from "@/ui/alert";
import { ImageLinkOrUpload, type ImageLinkOrUploadValue } from "@/components/admin/image-link-or-upload";
import { MobileIconPngUpload, type MobileIconPngValue } from "@/components/admin/mobile-icon-png-upload";

interface ServiceCategoryFormProps {
  category?: {
    id: string;
    name: string;
    description: string | null;
    image: string | null;
    mobileIcon: string | null;
    commissionRate: number;
    isActive: boolean;
  };
}

export function ServiceCategoryForm({ category }: ServiceCategoryFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: category?.name ?? "",
    description: category?.description ?? "",
    commissionRate: category?.commissionRate ?? 10.0,
    isActive: category?.isActive ?? true,
  });
  const [imageValue, setImageValue] = useState<ImageLinkOrUploadValue>(null);
  const [mobileIconValue, setMobileIconValue] = useState<MobileIconPngValue>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("Category name is required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = new FormData();
      data.append("name", formData.name);
      data.append("description", formData.description);
      data.append("commissionRate", String(formData.commissionRate));
      data.append("isActive", String(formData.isActive));
      if (imageValue?.type === "file") {
        data.append("categoryImage", imageValue.file);
      } else if (imageValue?.type === "url" && imageValue.url) {
        data.append("categoryImageUrl", imageValue.url);
      }
      if (mobileIconValue?.type === "file") {
        data.append("mobileIcon", mobileIconValue.file);
      } else if (mobileIconValue?.type === "url" && mobileIconValue.url) {
        data.append("mobileIconUrl", mobileIconValue.url);
      }

      const url = category
        ? `/api/admin/service-categories/${category.id}`
        : "/api/admin/service-categories";
      const method = category ? "PUT" : "POST";
      if (category) {
        data.append("removeCategoryImage", "false");
        if (category.image) data.append("existingCategoryImage", category.image);
      }

      const response = await fetch(url, { method, body: data });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Failed to save service category");
      }
      router.push("/admin/service-categories?success=" + (category ? "Service category updated successfully" : "Service category created successfully"));
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-foreground px-2 sm:px-0 max-w-4xl">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          {category ? "Edit Service Category" : "Create Service Category"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Service categories have no subcategories. Used for organizing services only.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="rounded-lg">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="overflow-hidden border shadow-sm">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-lg">Details</CardTitle>
          <CardDescription>Basic info and media for this service category.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic info */}
          <div className="grid gap-4 sm:grid-cols-1">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">Name <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Beauty & Wellness"
                required
                className="max-w-md"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Short category description"
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          {/* Media: image + mobile icon */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-6">
            <p className="text-sm font-medium text-foreground">Media</p>
            <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
              <div className="space-y-2">
                <ImageLinkOrUpload
                  label="Category image"
                  value={imageValue}
                  onChange={setImageValue}
                  currentImage={!imageValue && category?.image ? category.image : undefined}
                  showPreview={true}
                />
              </div>
              <div className="space-y-2">
                <MobileIconPngUpload
                  label="Mobile icon"
                  value={mobileIconValue}
                  onChange={setMobileIconValue}
                  currentImage={category?.mobileIcon ?? undefined}
                  showPreview={true}
                />
                <p className="text-xs text-muted-foreground">PNG only. Optional; used on mobile.</p>
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="flex flex-wrap items-center gap-6 rounded-lg border bg-muted/20 p-4">
            <div className="space-y-2 min-w-[140px]">
              <Label htmlFor="commissionRate" className="text-sm font-medium">Commission (%)</Label>
              <Input
                id="commissionRate"
                name="commissionRate"
                type="number"
                step="0.1"
                min={0}
                max={100}
                value={formData.commissionRate}
                onChange={handleChange}
                className="w-24"
              />
            </div>
            <div className="flex items-center gap-2 pt-6 sm:pt-0">
              <input
                id="isActive"
                name="isActive"
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-input bg-background accent-primary"
              />
              <Label htmlFor="isActive" className="text-sm font-medium cursor-pointer">Active</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 pb-4">
        <Button type="button" variant="outline" onClick={() => router.push("/admin/service-categories")} className="w-full sm:w-auto">
          Cancel
        </Button>
        <Button type="submit" disabled={loading} className="w-full sm:w-auto">
          {loading ? (category ? "Updating…" : "Creating…") : category ? "Update category" : "Create category"}
        </Button>
      </div>
    </form>
  );
}
