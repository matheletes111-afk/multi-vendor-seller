"use client";

import { useState, useEffect } from "react";
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
  id?: string;
  name: string;
  description: string;
  image?: string | null;
  mobileIcon?: string | null;
  existingImage?: string | null;
  existingMobileIcon?: string | null;
  imageValue?: ImageLinkOrUploadValue | null;
  imagePreview?: string;
  mobileIconValue?: MobileIconPngValue | null;
  isActive: boolean;
  removeImage?: boolean;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  mobileIcon?: string | null;
  commissionRate: number;
  isActive: boolean;
  subcategories: Subcategory[];
}

export function EditCategoryForm({ category }: { category: Category }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  
  // Form state
  const [categoryData, setCategoryData] = useState({
    name: category.name,
    description: category.description || "",
    commissionRate: category.commissionRate,
    isActive: category.isActive,
  });

  // Category image (link or file)
  const [categoryImageValue, setCategoryImageValue] = useState<ImageLinkOrUploadValue>(null);
  const [removeCategoryImage, setRemoveCategoryImage] = useState(false);
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

  // Initialize subcategories from props
  useEffect(() => {
    setSubcategories(
      category.subcategories.map(sub => ({
        id: sub.id,
        name: sub.name,
        description: sub.description || "",
        existingImage: sub.image,
        existingMobileIcon: sub.mobileIcon,
        imagePreview: sub.image || undefined,
        imageValue: null,
        mobileIconValue: null,
        isActive: sub.isActive,
      }))
    );
  }, [category.subcategories]);

  const handleCategoryChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setCategoryData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleCategoryImageChange = (value: ImageLinkOrUploadValue) => {
    setCategoryImageValue(value);
    if (value) setRemoveCategoryImage(false);
    else setRemoveCategoryImage(true);
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

    if (editingIndex !== null) {
      const updated = [...subcategories];
      updated[editingIndex] = { ...subcategoryForm };
      setSubcategories(updated);
      setEditingIndex(null);
    } else {
      setSubcategories([...subcategories, { ...subcategoryForm }]);
    }

    setSubcategoryForm({
      name: "",
      description: "",
      imageValue: null,
      imagePreview: undefined,
      mobileIconValue: null,
      isActive: true,
      removeImage: false
    });
    setError("");
  };

  const editSubcategory = (index: number) => {
    setSubcategoryForm(subcategories[index]);
    setEditingIndex(index);
  };

  const removeSubcategory = (index: number) => {
    // If this subcategory has an existing image, mark it for deletion
    const subToRemove = subcategories[index];
    if (subToRemove.existingImage) {
      // We'll handle this in the API
      console.log("Subcategory with image will be deleted:", subToRemove.existingImage);
    }
    
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
        removeImage: false
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
      formData.append("removeCategoryImage", removeCategoryImage.toString());
      if (category.image) {
        formData.append("existingCategoryImage", category.image);
      }
      if (categoryMobileIconValue?.type === "file") {
        formData.append("categoryMobileIcon", categoryMobileIconValue.file);
      } else if (categoryMobileIconValue?.type === "url" && categoryMobileIconValue.url) {
        formData.append("categoryMobileIconUrl", categoryMobileIconValue.url);
      }

      const subcategoriesPayload = subcategories.map(sub => ({
        id: sub.id,
        name: sub.name,
        description: sub.description,
        existingImage: sub.existingImage,
        existingMobileIcon: sub.existingMobileIcon,
        isActive: sub.isActive,
        removeImage: sub.removeImage || false
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

      // Track which images to delete (for removed subcategories with existing images)
      // This would require comparing with original category.subcategories
      const originalSubIds = category.subcategories.map(s => s.id);
      const currentSubIds = subcategories.filter(s => s.id).map(s => s.id);
      const removedSubIds = originalSubIds.filter(id => !currentSubIds.includes(id));
      
      const removedSubImages = category.subcategories
        .filter(sub => removedSubIds.includes(sub.id) && sub.image)
        .map(sub => sub.image);
      
      formData.append("deletedSubcategoryImages", JSON.stringify(removedSubImages));

      console.log("Submitting edit form...");

      const response = await fetch(`/api/admin/categories/${category.id}`, {
        method: "PUT",
        body: formData, // Don't set Content-Type header, browser will set it correctly
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update category");
      }

      router.push("/admin/categories?success=Category updated successfully");
      router.refresh();
    } catch (err: any) {
      console.error("Error submitting form:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-foreground px-2 sm:px-0 max-w-4xl">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Edit Product Category</h1>
        <p className="text-sm text-muted-foreground">Update category and subcategories.</p>
      </div>

      {error && (
        <Alert variant="destructive" className="rounded-lg">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
                  onChange={handleCategoryImageChange}
                  currentImage={!categoryImageValue && !removeCategoryImage ? category.image ?? undefined : undefined}
                  showPreview={true}
                />
              </div>
              <div className="space-y-2">
                <MobileIconPngUpload
                  label="Mobile icon (PNG)"
                  value={categoryMobileIconValue}
                  onChange={setCategoryMobileIconValue}
                  currentImage={category.mobileIcon ?? undefined}
                  showPreview={true}
                />
                <p className="text-xs text-muted-foreground">Optional.</p>
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
                min={0}
                max={100}
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

      <Card className="overflow-hidden border shadow-sm">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-lg">Subcategories</CardTitle>
          <CardDescription>Add or edit subcategories. Each can have an image and mobile icon.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Subcategory Form */}
          <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-foreground">
              {editingIndex !== null ? "Edit subcategory" : "Add subcategory"}
            </h3>
            
            <div className="space-y-2">
              <Label htmlFor="subName">Subcategory Name *</Label>
              <Input
                id="subName"
                name="name"
                value={subcategoryForm.name}
                onChange={handleSubcategoryChange}
                placeholder="e.g., Smartphones"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subDescription">Description</Label>
              <Textarea
                id="subDescription"
                name="description"
                value={subcategoryForm.description}
                onChange={handleSubcategoryChange}
                placeholder="Subcategory description"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <ImageLinkOrUpload
                label="Subcategory Image"
                value={subcategoryForm.imageValue ?? null}
                onChange={(v) => setSubcategoryForm(prev => ({ ...prev, imageValue: v ?? undefined }))}
                currentImage={subcategoryForm.removeImage ? undefined : (subcategoryForm.imagePreview || subcategoryForm.existingImage)}
                showPreview={true}
              />
            </div>
            <div className="space-y-2">
              <MobileIconPngUpload
                label="Subcategory mobile icon"
                value={subcategoryForm.mobileIconValue ?? null}
                onChange={(v) => setSubcategoryForm(prev => ({ ...prev, mobileIconValue: v ?? undefined }))}
                currentImage={subcategoryForm.existingMobileIcon ?? undefined}
                showPreview={true}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                id="subIsActive"
                name="isActive"
                type="checkbox"
                checked={subcategoryForm.isActive}
                onChange={(e) => setSubcategoryForm(prev => ({ ...prev, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="subIsActive" className="text-sm font-normal">Active</Label>
            </div>

            <div className="flex gap-2">
              <Button 
                type="button" 
                onClick={addOrUpdateSubcategory}
                variant={editingIndex !== null ? "default" : "outline"}
              >
                <Plus className="mr-2 h-4 w-4" />
                {editingIndex !== null ? "Update Subcategory" : "Add Subcategory"}
              </Button>
              {editingIndex !== null && (
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => {
                    setEditingIndex(null);
                    setSubcategoryForm({
                      name: "",
                      description: "",
                      imageValue: null,
                      imagePreview: undefined,
                      mobileIconValue: null,
                      isActive: true,
                      removeImage: false
                    });
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>

          {/* Subcategories List */}
          {subcategories.length > 0 && (
            <div className="space-y-3">
              <Separator />
              <p className="text-sm font-medium text-foreground">Subcategories ({subcategories.length})</p>
              <div className="space-y-2">
                {subcategories.map((sub, index) => (
                  <div key={index} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border bg-card">
                    <div className="flex flex-1 items-center gap-3 min-w-0">
                      {(sub.imagePreview || sub.existingImage || (sub.imageValue?.type === "url" && sub.imageValue?.url)) && (
                        <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0 rounded overflow-hidden bg-muted border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={sub.imageValue?.type === "url" ? sub.imageValue.url : (sub.imagePreview || sub.existingImage || "")} alt={sub.name} className="w-full h-full object-cover" />
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
        <Button type="button" variant="outline" onClick={() => router.push("/admin/categories")} className="w-full sm:w-auto">Cancel</Button>
        <Button type="submit" disabled={loading} className="w-full sm:w-auto">{loading ? "Updating…" : "Update category"}</Button>
      </div>
    </form>
  );
}