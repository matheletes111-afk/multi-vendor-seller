"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { Alert, AlertDescription } from "@/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { ImageUpload } from "@/ui/image-upload";
import { ChevronLeft } from "lucide-react";

interface Category {
  id: string;
  name: string;
  subcategories: {
    id: string;
    name: string;
  }[];
}

interface Banner {
  id: string;
  bannerHeading: string;
  bannerDescription: string | null;
  bannerImage: string;
  isActive: boolean;
  categoryId?: string | null;
  subcategoryId?: string | null;
}

// Special values for "none" selection
const NONE_CATEGORY = "none";
const NONE_SUBCATEGORY = "none";

export function BannerForm({ 
  banner, 
  categories 
}: { 
  banner?: Banner;
  categories: Category[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Form state - convert null/undefined to "none" for selects
  const [formData, setFormData] = useState({
    bannerHeading: banner?.bannerHeading || "",
    bannerDescription: banner?.bannerDescription || "",
    isActive: banner?.isActive ?? true,
    categoryId: banner?.categoryId || NONE_CATEGORY,
    subcategoryId: banner?.subcategoryId || NONE_SUBCATEGORY,
  });

  const [bannerImage, setBannerImage] = useState<File | null>(null);
  const [bannerImagePreview, setBannerImagePreview] = useState<string | null>(banner?.bannerImage || null);
  const [selectedCategory, setSelectedCategory] = useState<string>(banner?.categoryId || NONE_CATEGORY);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    setFormData(prev => ({ 
      ...prev, 
      categoryId: value,
      subcategoryId: NONE_SUBCATEGORY // Reset subcategory when category changes
    }));
  };

  const handleSubcategoryChange = (value: string) => {
    setFormData(prev => ({ ...prev, subcategoryId: value }));
  };

  const handleImageSelect = (file: File | null) => {
    if (file) {
      // Clean up previous preview
      if (bannerImagePreview && !banner?.bannerImage) {
        URL.revokeObjectURL(bannerImagePreview);
      }
      
      setBannerImage(file);
      const preview = URL.createObjectURL(file);
      setBannerImagePreview(preview);
    } else {
      if (bannerImagePreview && !banner?.bannerImage) {
        URL.revokeObjectURL(bannerImagePreview);
      }
      setBannerImage(null);
      setBannerImagePreview(banner?.bannerImage || null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.bannerHeading.trim()) {
      setError("Banner heading is required");
      return;
    }

    if (!bannerImage && !banner?.bannerImage) {
      setError("Banner image is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formDataObj = new FormData();
      
      // Append banner data - convert "none" back to empty string for API
      formDataObj.append("bannerHeading", formData.bannerHeading);
      formDataObj.append("bannerDescription", formData.bannerDescription);
      formDataObj.append("isActive", formData.isActive.toString());
      formDataObj.append("categoryId", formData.categoryId === NONE_CATEGORY ? "" : formData.categoryId);
      formDataObj.append("subcategoryId", formData.subcategoryId === NONE_SUBCATEGORY ? "" : formData.subcategoryId);
      
      // Append image if new one selected
      if (bannerImage) {
        formDataObj.append("bannerImage", bannerImage);
      }

      // Track if image was removed
      if (!bannerImage && !bannerImagePreview && banner?.bannerImage) {
        formDataObj.append("removeImage", "true");
      }

      const url = banner 
        ? `/api/admin/banners/${banner.id}`
        : "/api/admin/banners";

      const method = banner ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        body: formDataObj,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${banner ? 'update' : 'create'} banner`);
      }

      // Clean up preview
      if (bannerImagePreview && !banner?.bannerImage) {
        URL.revokeObjectURL(bannerImagePreview);
      }

      router.push(`/admin/banners?success=Banner ${banner ? 'updated' : 'created'} successfully`);
      router.refresh();
    } catch (err: any) {
      console.error("Error submitting form:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Get subcategories for selected category
  const selectedCategoryData = categories.find(c => c.id === selectedCategory);
  const subcategories = selectedCategoryData?.subcategories || [];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            type="button" 
            variant="ghost" 
            size="sm"
            onClick={() => router.back()}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">
            {banner ? "Edit Banner" : "Create New Banner"}
          </h1>
        </div>
        <div className="space-x-2">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => router.push("/admin/banners")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : (banner ? "Update Banner" : "Create Banner")}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Column - Banner Details */}
        <Card>
          <CardHeader>
            <CardTitle>Banner Details</CardTitle>
            <CardDescription>Enter the banner information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bannerHeading">Banner Heading *</Label>
              <Input
                id="bannerHeading"
                name="bannerHeading"
                value={formData.bannerHeading}
                onChange={handleChange}
                placeholder="e.g., Summer Sale 2024"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bannerDescription">Description</Label>
              <Textarea
                id="bannerDescription"
                name="bannerDescription"
                value={formData.bannerDescription}
                onChange={handleChange}
                placeholder="Enter banner description..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Banner Image *</Label>
              <ImageUpload
                onImageSelect={handleImageSelect}
              />
              {banner?.bannerImage && !bannerImage && (
                <p className="text-xs text-muted-foreground mt-1">
                  Current image: {banner.bannerImage.split('/').pop()}
                </p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <input
                id="isActive"
                name="isActive"
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="isActive" className="text-sm font-normal">Active</Label>
            </div>
          </CardContent>
        </Card>

        {/* Right Column - Targeting */}
        <Card>
          <CardHeader>
            <CardTitle>Banner Targeting</CardTitle>
            <CardDescription>
              Select where this banner should appear (optional)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category (Optional)</Label>
              <Select
                value={formData.categoryId}
                onValueChange={handleCategoryChange}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_CATEGORY}>All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subcategory">Subcategory (Optional)</Label>
              <Select
                value={formData.subcategoryId}
                onValueChange={handleSubcategoryChange}
                disabled={!selectedCategory || selectedCategory === NONE_CATEGORY}
              >
                <SelectTrigger id="subcategory">
                  <SelectValue placeholder={
                    !selectedCategory || selectedCategory === NONE_CATEGORY
                      ? "Select a category first" 
                      : "Select a subcategory"
                  } />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_SUBCATEGORY}>All Subcategories</SelectItem>
                  {subcategories.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium mb-2">Preview Targeting:</p>
              <p className="text-sm text-muted-foreground">
                {formData.categoryId === NONE_CATEGORY && formData.subcategoryId === NONE_SUBCATEGORY && (
                  "This banner will show on all pages"
                )}
                {formData.categoryId !== NONE_CATEGORY && formData.subcategoryId === NONE_SUBCATEGORY && (
                  `This banner will show on ${categories.find(c => c.id === formData.categoryId)?.name} category pages`
                )}
                {formData.subcategoryId !== NONE_SUBCATEGORY && (
                  `This banner will show on ${subcategories.find(s => s.id === formData.subcategoryId)?.name} subcategory pages`
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Image Preview */}
      {bannerImagePreview && (
        <Card>
          <CardHeader>
            <CardTitle>Image Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative w-full max-w-2xl h-64 border rounded-lg overflow-hidden">
              <Image
                src={bannerImagePreview}
                alt="Banner preview"
                fill
                className="object-cover"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </form>
  );
}