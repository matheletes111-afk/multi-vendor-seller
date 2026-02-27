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
import { Plus, Trash2, Pencil } from "lucide-react";
import Image from "next/image";

interface Subcategory {
  name: string;
  description: string;
  imageValue?: ImageLinkOrUploadValue | null;
  imagePreview?: string;
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

  // Subcategory form state
  const [subcategoryForm, setSubcategoryForm] = useState<Subcategory>({
    name: "",
    description: "",
    imageValue: null,
    imagePreview: undefined,
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
    <form onSubmit={handleSubmit} className="space-y-6 text-foreground">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Create New Category</h1>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Category Details */}
      <Card>
        <CardHeader>
          <CardTitle>Category Details</CardTitle>
          <CardDescription>Enter the main category information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Category Name *</Label>
            <Input
              id="name"
              name="name"
              value={categoryData.name}
              onChange={handleCategoryChange}
              placeholder="e.g., Electronics"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={categoryData.description}
              onChange={handleCategoryChange}
              placeholder="Category description"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <ImageLinkOrUpload
              label="Category Image"
              value={categoryImageValue}
              onChange={setCategoryImageValue}
              showPreview={true}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="commissionRate">Commission Rate (%)</Label>
            <Input
              id="commissionRate"
              name="commissionRate"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={categoryData.commissionRate}
              onChange={handleCategoryChange}
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              id="isActive"
              name="isActive"
              type="checkbox"
              checked={categoryData.isActive}
              onChange={(e) => setCategoryData(prev => ({ ...prev, isActive: e.target.checked }))}
              className="h-4 w-4 rounded border-input bg-background accent-primary"
            />
            <Label htmlFor="isActive" className="text-sm font-normal text-foreground">Active</Label>
          </div>
        </CardContent>
      </Card>

      {/* Subcategories Section */}
      <Card>
        <CardHeader>
          <CardTitle>Subcategories</CardTitle>
          <CardDescription>Add subcategories under this category</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Subcategory Form */}
          <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/50">
            <h3 className="font-medium text-foreground">
              {editingIndex !== null ? "Edit Subcategory" : "Add New Subcategory"}
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
                className="h-4 w-4 rounded border-input bg-background accent-primary"
              />
              <Label htmlFor="subIsActive" className="text-sm font-normal text-foreground">Active</Label>
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
                      isActive: true,
                    });
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>

          {/* Subcategories List with Images */}
          {subcategories.length > 0 && (
            <div className="space-y-4">
              <Separator />
              <h3 className="font-medium text-foreground">Added Subcategories ({subcategories.length})</h3>
              <div className="space-y-3">
                {subcategories.map((sub, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 border border-border rounded-lg bg-card"
                  >
                    {(sub.imagePreview || (sub.imageValue?.type === "url" && sub.imageValue.url)) && (
                      <div className="relative w-16 h-16 flex-shrink-0 border border-border rounded overflow-hidden bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={sub.imageValue?.type === "url" ? sub.imageValue.url : sub.imagePreview!}
                          alt={sub.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{sub.name}</span>
                        {!sub.isActive && (
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">Inactive</span>
                        )}
                      </div>
                      {sub.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {sub.description}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => editSubcategory(index)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSubcategory(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Category"}
        </Button>
      </div>
    </form>
  );
}