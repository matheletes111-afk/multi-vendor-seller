"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { Alert, AlertDescription } from "@/ui/alert";
import { Separator } from "@/ui/separator";
import { ImageLinkOrUpload, type ImageLinkOrUploadValue } from "@/components/admin/image-link-or-upload";
import { MobileIconPngUpload, type MobileIconPngValue } from "@/components/admin/mobile-icon-png-upload";
import { Plus, Trash2, Pencil } from "lucide-react";
import Image from "next/image";

interface Subcategory {
  name: string;
  description: string;
  imageValue?: ImageLinkOrUploadValue | null;
  imagePreview?: string;
  mobileIconValue?: MobileIconPngValue | null;
  isActive: boolean;
}

export function CategoryForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  
  // Form state
  const [categoryData, setCategoryData] = useState({
    name: "",
    description: "",
    commissionRate: 10.0,
    isActive: true,
  });

  // Category image (link or file)
  const [categoryImageValue, setCategoryImageValue] = useState<ImageLinkOrUploadValue>(null);
  const [categoryMobileIconValue, setCategoryMobileIconValue] = useState<MobileIconPngValue>(null);

  // Subcategory form state
  const [subcategoryForm, setSubcategoryForm] = useState<Subcategory>({
    name: "",
    description: "",
    imageValue: null,
    imagePreview: undefined,
    mobileIconValue: null,
    isActive: true,
  });

  const handleCategoryChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setCategoryData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubcategoryChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setSubcategoryForm(prev => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const addOrUpdateSubcategory = () => {
    if (!subcategoryForm.name.trim()) {
      setError("Subcategory name is required");
      return;
    }

    const isDuplicate = subcategories.some((sub, index) => 
      sub.name.toLowerCase() === subcategoryForm.name.toLowerCase() && 
      (editingIndex === null || index !== editingIndex)
    );

    if (isDuplicate) {
      setError("A subcategory with this name already exists");
      return;
    }

    const item = { ...subcategoryForm };
    if (item.imageValue?.type === "file") {
      item.imagePreview = URL.createObjectURL(item.imageValue.file);
    } else if (item.imageValue?.type === "url") {
      item.imagePreview = item.imageValue.url;
    }
    if (editingIndex !== null) {
      const updated = [...subcategories];
      updated[editingIndex] = item;
      setSubcategories(updated);
      setEditingIndex(null);
    } else {
      setSubcategories([...subcategories, item]);
    }

    setSubcategoryForm({
      name: "",
      description: "",
      imageValue: null,
      imagePreview: undefined,
      mobileIconValue: null,
      isActive: true,
    });
    setError("");
  };

  const editSubcategory = (index: number) => {
    setSubcategoryForm(subcategories[index]);
    setEditingIndex(index);
  };

  const removeSubcategory = (index: number) => {
    setSubcategories(subcategories.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setSubcategoryForm({
        name: "",
        description: "",
        imageValue: null,
        imagePreview: undefined,
        mobileIconValue: null,
        isActive: true,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!categoryData.name.trim()) {
      setError("Category name is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      
      // Append category data
      formData.append("name", categoryData.name);
      formData.append("description", categoryData.description);
      formData.append("commissionRate", categoryData.commissionRate.toString());
      formData.append("isActive", categoryData.isActive.toString());

      if (categoryImageValue?.type === "file") {
        formData.append("categoryImage", categoryImageValue.file);
      } else if (categoryImageValue?.type === "url" && categoryImageValue.url) {
        formData.append("categoryImageUrl", categoryImageValue.url);
      }
      if (categoryMobileIconValue?.type === "file") {
        formData.append("categoryMobileIcon", categoryMobileIconValue.file);
      } else if (categoryMobileIconValue?.type === "url" && categoryMobileIconValue.url) {
        formData.append("categoryMobileIconUrl", categoryMobileIconValue.url);
      }

      const subcategoriesPayload = subcategories.map(sub => ({
        name: sub.name,
        description: sub.description,
        isActive: sub.isActive,
      }));
      formData.append("subcategories", JSON.stringify(subcategoriesPayload));

      subcategories.forEach((sub, index) => {
        if (sub.imageValue?.type === "file") {
          formData.append(`subcategoryImage_${index}`, sub.imageValue.file);
        } else if (sub.imageValue?.type === "url" && sub.imageValue.url) {
          formData.append(`subcategoryImageUrl_${index}`, sub.imageValue.url);
        }
        if (sub.mobileIconValue?.type === "file") {
          formData.append(`subcategoryMobileIcon_${index}`, sub.mobileIconValue.file);
        } else if (sub.mobileIconValue?.type === "url" && sub.mobileIconValue.url) {
          formData.append(`subcategoryMobileIconUrl_${index}`, sub.mobileIconValue.url);
        }
      });

      const response = await fetch("/api/admin/categories", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create category");
      }

      router.push("/admin/categories?success=Category created successfully");
      router.refresh();
    } catch (err: any) {
      console.error("Error submitting form:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push("/admin/categories");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-foreground px-2 sm:px-0 max-w-4xl">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Create Product Category</h1>
        <p className="text-sm text-muted-foreground">Product categories can have subcategories. Used for organizing products.</p>
      </div>

      {error && (
        <Alert variant="destructive" className="rounded-lg">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Category details */}
      <Card className="overflow-hidden border shadow-sm">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-lg">Category details</CardTitle>
          <CardDescription>Name, description, images, and settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-1">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">Name <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                name="name"
                value={categoryData.name}
                onChange={handleCategoryChange}
                placeholder="e.g., Electronics"
                required
                className="max-w-md"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={categoryData.description}
                onChange={handleCategoryChange}
                placeholder="Category description"
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 space-y-6">
            <p className="text-sm font-medium text-foreground">Media</p>
            <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
              <div className="space-y-2">
                <ImageLinkOrUpload
                  label="Category image"
                  value={categoryImageValue}
                  onChange={setCategoryImageValue}
                  showPreview={true}
                />
              </div>
              <div className="space-y-2">
                <MobileIconPngUpload
                  label="Mobile icon"
                  value={categoryMobileIconValue}
                  onChange={setCategoryMobileIconValue}
                  showPreview={true}
                />
                <p className="text-xs text-muted-foreground">PNG only. Optional.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 rounded-lg border bg-muted/20 p-4">
            <div className="space-y-2 min-w-[140px]">
              <Label htmlFor="commissionRate" className="text-sm font-medium">Commission (%)</Label>
              <Input
                id="commissionRate"
                name="commissionRate"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={categoryData.commissionRate}
                onChange={handleCategoryChange}
                className="w-24"
              />
            </div>
            <div className="flex items-center gap-2 pt-6 sm:pt-0">
              <input
                id="isActive"
                name="isActive"
                type="checkbox"
                checked={categoryData.isActive}
                onChange={(e) => setCategoryData(prev => ({ ...prev, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-input bg-background accent-primary"
              />
              <Label htmlFor="isActive" className="text-sm font-medium cursor-pointer">Active</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subcategories */}
      <Card className="overflow-hidden border shadow-sm">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-lg">Subcategories</CardTitle>
          <CardDescription>Add subcategories under this category. Each can have an image and mobile icon.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-foreground">
              {editingIndex !== null ? "Edit subcategory" : "Add subcategory"}
            </h3>
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="subName" className="text-sm font-medium">Name <span className="text-destructive">*</span></Label>
                <Input
                  id="subName"
                  name="name"
                  value={subcategoryForm.name}
                  onChange={handleSubcategoryChange}
                  placeholder="e.g., Smartphones"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subDescription" className="text-sm font-medium">Description</Label>
                <Textarea
                  id="subDescription"
                  name="description"
                  value={subcategoryForm.description}
                  onChange={handleSubcategoryChange}
                  placeholder="Optional"
                  rows={2}
                  className="resize-none"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 pt-2">
              <div className="space-y-2">
                <ImageLinkOrUpload
                  label="Subcategory image"
                  value={subcategoryForm.imageValue ?? null}
                  onChange={(v) => setSubcategoryForm(prev => ({ ...prev, imageValue: v ?? undefined }))}
                  showPreview={true}
                />
              </div>
              <div className="space-y-2">
                <MobileIconPngUpload
                  label="Subcategory mobile icon (PNG)"
                  value={subcategoryForm.mobileIconValue ?? null}
                  onChange={(v) => setSubcategoryForm(prev => ({ ...prev, mobileIconValue: v ?? undefined }))}
                  showPreview={true}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <div className="flex items-center gap-2">
                <input
                  id="subIsActive"
                  name="isActive"
                  type="checkbox"
                  checked={subcategoryForm.isActive}
                  onChange={(e) => setSubcategoryForm(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border-input bg-background accent-primary"
                />
                <Label htmlFor="subIsActive" className="text-sm font-medium cursor-pointer">Active</Label>
              </div>
              <div className="flex gap-2">
                <Button type="button" onClick={addOrUpdateSubcategory} variant={editingIndex !== null ? "default" : "outline"} size="sm" className="shrink-0">
                  <Plus className="mr-2 h-4 w-4" />
                  {editingIndex !== null ? "Update" : "Add"}
                </Button>
                {editingIndex !== null && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setEditingIndex(null); setSubcategoryForm({ name: "", description: "", imageValue: null, imagePreview: undefined, mobileIconValue: null, isActive: true }); }}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </div>

          {subcategories.length > 0 && (
            <div className="space-y-3">
              <Separator />
              <p className="text-sm font-medium text-foreground">Added ({subcategories.length})</p>
              <div className="space-y-2">
                {subcategories.map((sub, index) => (
                  <div key={index} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border bg-card">
                    <div className="flex flex-1 items-center gap-3 min-w-0">
                      {(sub.imagePreview || (sub.imageValue?.type === "url" && sub.imageValue?.url)) && (
                        <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0 rounded overflow-hidden bg-muted border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={sub.imageValue?.type === "url" ? sub.imageValue.url : sub.imagePreview!} alt={sub.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="font-medium text-foreground block truncate">{sub.name}</span>
                        {sub.description && <p className="text-xs text-muted-foreground line-clamp-1">{sub.description}</p>}
                        {!sub.isActive && <span className="text-xs text-muted-foreground">Inactive</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => editSubcategory(index)}><Pencil className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeSubcategory(index)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 pb-4">
        <Button type="button" variant="outline" onClick={handleCancel} className="w-full sm:w-auto">Cancel</Button>
        <Button type="submit" disabled={loading} className="w-full sm:w-auto">{loading ? "Creating…" : "Create category"}</Button>
      </div>
    </form>
  );
}