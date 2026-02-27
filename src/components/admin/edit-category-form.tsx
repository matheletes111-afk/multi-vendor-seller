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
import { ImageUpload } from "@/ui/image-upload";
import { Plus, Trash2, Pencil } from "lucide-react";
import Image from "next/image";

interface Subcategory {
  id?: string;
  name: string;
  description: string;
  existingImage?: string | null;
  imageFile?: File | null;
  imagePreview?: string;
  isActive: boolean;
  removeImage?: boolean;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
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

  // Category image
  const [categoryImage, setCategoryImage] = useState<File | null>(null);
  const [categoryImagePreview, setCategoryImagePreview] = useState<string | null>(category.image);
  const [removeCategoryImage, setRemoveCategoryImage] = useState(false);

  // Subcategory form state
  const [subcategoryForm, setSubcategoryForm] = useState<Subcategory>({
    name: "",
    description: "",
    imageFile: null,
    imagePreview: undefined,
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
        imagePreview: sub.image || undefined,
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

  const handleCategoryImage = (file: File | null) => {
    if (file) {
      setCategoryImage(file);
      const preview = URL.createObjectURL(file);
      setCategoryImagePreview(preview);
      setRemoveCategoryImage(false);
    } else {
      setCategoryImage(null);
      setCategoryImagePreview(null);
      setRemoveCategoryImage(true);
    }
  };

  const handleSubcategoryChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setSubcategoryForm(prev => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubcategoryImage = (file: File | null) => {
    if (file) {
      const preview = URL.createObjectURL(file);
      setSubcategoryForm(prev => ({
        ...prev,
        imageFile: file,
        imagePreview: preview,
        removeImage: false
      }));
    } else {
      setSubcategoryForm(prev => ({
        ...prev,
        imageFile: null,
        imagePreview: undefined,
        removeImage: true
      }));
    }
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
      imageFile: null,
      imagePreview: undefined,
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
        imageFile: null,
        imagePreview: undefined,
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
      
      // Append category image if changed
      if (categoryImage) {
        formData.append("categoryImage", categoryImage);
      }
      
      // Track if category image was removed
      formData.append("removeCategoryImage", removeCategoryImage.toString());
      
      // Keep track of existing category image for reference
      if (category.image) {
        formData.append("existingCategoryImage", category.image);
      }

      // Prepare subcategories data
      const subcategoriesPayload = subcategories.map(sub => ({
        id: sub.id,
        name: sub.name,
        description: sub.description,
        existingImage: sub.existingImage,
        isActive: sub.isActive,
        removeImage: sub.removeImage || false
      }));

      formData.append("subcategories", JSON.stringify(subcategoriesPayload));

      // Collect images to delete (for subcategories that were removed)
      const deletedImages: string[] = [];
      
      // Append subcategory images with index
      subcategories.forEach((sub, index) => {
        if (sub.imageFile) {
          formData.append(`subcategoryImage_${index}`, sub.imageFile);
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
    <form onSubmit={handleSubmit} className="space-y-6 text-foreground">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Edit Category</h1>
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
          <CardDescription>Update category information</CardDescription>
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
            <Label>Category Image</Label>
            <ImageUpload
              onImageSelect={handleCategoryImage}
              currentImage={categoryImagePreview}
            />
            {category.image && !categoryImagePreview && !removeCategoryImage && (
              <p className="text-sm text-muted-foreground mt-1">
                Current image: {category.image.split('/').pop()}
              </p>
            )}
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
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="isActive" className="text-sm font-normal">Active</Label>
          </div>
        </CardContent>
      </Card>

      {/* Subcategories Section */}
      <Card>
        <CardHeader>
          <CardTitle>Subcategories</CardTitle>
          <CardDescription>Manage subcategories under this category</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Subcategory Form */}
          <div className="space-y-4 p-4 border border-border rounded-lg bg-muted">
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
              <Label>Subcategory Image</Label>
              <ImageUpload
                onImageSelect={handleSubcategoryImage}
                currentImage={subcategoryForm.imagePreview || subcategoryForm.existingImage}
              />
              {subcategoryForm.existingImage && !subcategoryForm.imagePreview && !subcategoryForm.removeImage && (
                <p className="text-sm text-muted-foreground mt-1">
                  Current image: {subcategoryForm.existingImage.split('/').pop()}
                </p>
              )}
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
                      imageFile: null,
                      imagePreview: undefined,
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
            <div className="space-y-4">
              <Separator />
              <h3 className="font-medium text-foreground">Subcategories ({subcategories.length})</h3>
              <div className="space-y-2">
                {subcategories.map((sub, index) => (
                  <div
                    key={index}
                    className="flex items-start justify-between p-3 border border-border rounded-lg bg-card"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{sub.name}</span>
                        {!sub.isActive && (
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">Inactive</span>
                        )}
                      </div>
                      {sub.description && (
                        <p className="text-sm text-muted-foreground mt-1">{sub.description}</p>
                      )}
                      {(sub.imagePreview || sub.existingImage) && (
                        <div className="mt-2 relative w-16 h-16">
                          <Image
                            src={sub.imagePreview || sub.existingImage || ""}
                            alt={sub.name}
                            fill
                            className="object-cover rounded"
                          />
                        </div>
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
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/categories")}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Updating..." : "Update Category"}
        </Button>
      </div>
    </form>
  );
}