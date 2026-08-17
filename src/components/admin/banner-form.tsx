"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { ImageLinkOrUpload, type ImageLinkOrUploadValue } from "@/components/admin/image-link-or-upload";
import { ChevronLeft } from "lucide-react";

function BannerPreviewFromFile({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="Banner preview" className="w-full h-full object-cover" />
  );
}

interface Category {
  id: string;
  name: string;
  subcategories: {
    id: string;
    name: string;
  }[];
}

interface ServiceCategory {
  id: string;
  name: string;
}

interface Banner {
  id: string;
  bannerHeading: string;
  bannerDescription: string | null;
  bannerImage: string;
  mobileBanner?: string | null;
  isActive: boolean;
  targetType?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  serviceCategoryId?: string | null;
}

// Special values for "none" selection
const NONE_CATEGORY = "none";
const NONE_SUBCATEGORY = "none";
const NONE_SERVICE_CATEGORY = "none";
const TARGET_PRODUCT = "product";
const TARGET_SERVICE = "service";

export function BannerForm({
  banner,
  categories,
  serviceCategories = [],
}: {
  banner?: Banner;
  categories: Category[];
  serviceCategories?: ServiceCategory[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Toggle: targetType (product, service, hotel, restaurant)
  const [targetType, setTargetType] = useState<string>(
    banner?.targetType || (banner?.serviceCategoryId ? "service" : "product")
  );

  const [formData, setFormData] = useState({
    bannerHeading: banner?.bannerHeading || "",
    bannerDescription: banner?.bannerDescription || "",
    isActive: banner?.isActive ?? true,
    categoryId: banner?.categoryId || NONE_CATEGORY,
    subcategoryId: banner?.subcategoryId || NONE_SUBCATEGORY,
    serviceCategoryId: banner?.serviceCategoryId || NONE_SERVICE_CATEGORY,
  });

  const [bannerImageValue, setBannerImageValue] = useState<ImageLinkOrUploadValue>(null);
  const [mobileBannerImageValue, setMobileBannerImageValue] = useState<ImageLinkOrUploadValue>(null);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.bannerHeading.trim()) {
      setError("Banner heading is required");
      return;
    }

    const hasImage = bannerImageValue?.type === "file" || bannerImageValue?.type === "url" || banner?.bannerImage;
    if (!hasImage) {
      setError("Banner image is required (link or upload)");
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
      formDataObj.append("targetType", targetType);
      formDataObj.append("categoryId", targetType === "product" && formData.categoryId !== NONE_CATEGORY ? formData.categoryId : "");
      formDataObj.append("subcategoryId", targetType === "product" && formData.subcategoryId !== NONE_SUBCATEGORY ? formData.subcategoryId : "");
      formDataObj.append("serviceCategoryId", targetType === "service" && formData.serviceCategoryId !== NONE_SERVICE_CATEGORY ? formData.serviceCategoryId : "");

      if (bannerImageValue?.type === "file") {
        formDataObj.append("bannerImage", bannerImageValue.file);
      } else if (bannerImageValue?.type === "url" && bannerImageValue.url) {
        formDataObj.append("bannerImageUrl", bannerImageValue.url);
      }

      if (mobileBannerImageValue?.type === "file") {
        formDataObj.append("mobileBanner", mobileBannerImageValue.file);
      } else if (mobileBannerImageValue?.type === "url" && mobileBannerImageValue.url) {
        formDataObj.append("mobileBannerUrl", mobileBannerImageValue.url);
      }
      if (!bannerImageValue && banner?.bannerImage) {
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
    <form onSubmit={handleSubmit} className="w-full space-y-8 pb-12">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-4 p-6 bg-card border border-border rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            onClick={() => router.back()}
            className="rounded-xl border-border hover:bg-muted text-xs font-semibold"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {banner ? "Edit Banner" : "Create New Banner"}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 font-medium">
              Configure hero promotional real estate across all 4 platform panels.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="rounded-2xl border-destructive/20 bg-destructive/10">
          <AlertDescription className="font-medium text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {/* Main 2-Column Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full items-start">
        
        {/* Left Column: Banner Content & Media Upload (8 columns) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          <Card className="border border-border/80 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/60 pb-4">
              <CardTitle className="text-lg font-bold text-foreground">Banner Details & Media</CardTitle>
              <CardDescription className="text-xs font-medium">
                Set banner heading, description, and upload responsive graphics.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="p-6 space-y-6">
              {/* Heading */}
              <div className="space-y-2">
                <Label htmlFor="bannerHeading" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Banner Heading <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="bannerHeading"
                  name="bannerHeading"
                  value={formData.bannerHeading}
                  onChange={handleChange}
                  placeholder="e.g., Exclusive Summer Hotel Discounts 40% Off"
                  className="h-11 rounded-xl text-sm font-semibold"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="bannerDescription" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Description
                </Label>
                <Textarea
                  id="bannerDescription"
                  name="bannerDescription"
                  value={formData.bannerDescription}
                  onChange={handleChange}
                  placeholder="Enter promotional tagline or description..."
                  className="rounded-xl text-sm leading-relaxed"
                  rows={3}
                />
              </div>

              {/* Image Upload Grid */}
              <div className="pt-4 border-t border-border/60 space-y-6">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {/* Desktop Upload Box */}
                  <div className="p-4 rounded-2xl bg-muted/20 border border-border/60 space-y-3">
                    <ImageLinkOrUpload
                      label="Desktop Banner Image *"
                      value={bannerImageValue}
                      onChange={setBannerImageValue}
                      currentImage={banner?.bannerImage}
                      showPreview={true}
                      required
                    />
                  </div>

                  {/* Mobile Upload Box */}
                  <div className="p-4 rounded-2xl bg-muted/20 border border-border/60 space-y-3">
                    <ImageLinkOrUpload
                      label="Mobile Banner Image (Optional)"
                      value={mobileBannerImageValue}
                      onChange={setMobileBannerImageValue}
                      currentImage={banner?.mobileBanner}
                      showPreview={true}
                    />
                  </div>
                </div>
              </div>

              {/* Active Toggle Switch */}
              <div className="pt-4 border-t border-border/60 flex items-center justify-between">
                <div>
                  <Label htmlFor="isActive" className="text-sm font-bold text-foreground cursor-pointer">
                    Publish Banner Immediately
                  </Label>
                  <p className="text-xs text-muted-foreground font-medium">Active banners appear in live hero carousels.</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="isActive"
                    name="isActive"
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                  <span className={`text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider ${
                    formData.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                  }`}>
                    {formData.isActive ? "Active" : "Draft"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Targeting Zone Configuration (4 columns) */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          <Card className="border border-border/80 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/60 pb-4">
              <CardTitle className="text-lg font-bold text-foreground">Targeting & Placement</CardTitle>
              <CardDescription className="text-xs font-medium">
                Choose section or category for this promotion
              </CardDescription>
            </CardHeader>
            
            <CardContent className="p-6 space-y-6">
              {/* Target Type Selector Cards */}
              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Target Panel / Section
                </Label>
                
                <div className="grid grid-cols-1 gap-2.5">
                  {[
                    { id: "product", label: "Marketplace / Products", icon: "🛍️", desc: "Main e-commerce shopping homepage" },
                    { id: "service", label: "Services", icon: "🛠️", desc: "On-demand local service catalog" },
                    { id: "hotel", label: "Hotels & Stays", icon: "🏨", desc: "Hotel booking & resort listings" },
                    { id: "restaurant", label: "Foods & Restaurants", icon: "🍔", desc: "Food delivery & dining page" },
                  ].map((item) => {
                    const isSelected = targetType === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setTargetType(item.id)}
                        className={`group flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5 shadow-xs font-bold text-foreground"
                            : "border-border/60 hover:border-primary/40 hover:bg-muted/20 text-muted-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{item.icon}</span>
                          <div>
                            <p className={`text-xs font-bold ${isSelected ? "text-foreground" : "text-slate-800"}`}>
                              {item.label}
                            </p>
                            <p className="text-[11px] text-muted-foreground font-normal line-clamp-1">{item.desc}</p>
                          </div>
                        </div>
                        <input
                          type="radio"
                          name="targetType"
                          value={item.id}
                          checked={isSelected}
                          onChange={() => setTargetType(item.id)}
                          className="h-4 w-4 text-primary border-border cursor-pointer"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Product Category Options */}
              {targetType === "product" && (
                <div className="space-y-4 pt-4 border-t border-border/60">
                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Product Category (Optional)
                    </Label>
                    <Select
                      value={formData.categoryId}
                      onValueChange={handleCategoryChange}
                    >
                      <SelectTrigger id="category" className="h-11 rounded-xl text-sm font-medium">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_CATEGORY}>All categories</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subcategory" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Subcategory (Optional)
                    </Label>
                    <Select
                      value={formData.subcategoryId}
                      onValueChange={handleSubcategoryChange}
                      disabled={!selectedCategory || selectedCategory === NONE_CATEGORY}
                    >
                      <SelectTrigger id="subcategory" className="h-11 rounded-xl text-sm font-medium">
                        <SelectValue placeholder={
                          !selectedCategory || selectedCategory === NONE_CATEGORY
                            ? "Select a category first"
                            : "Select a subcategory"
                        } />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_SUBCATEGORY}>All subcategories</SelectItem>
                        {subcategories.map((sub) => (
                          <SelectItem key={sub.id} value={sub.id}>
                            {sub.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Service Category Options */}
              {targetType === "service" && (
                <div className="space-y-2 pt-4 border-t border-border/60">
                  <Label htmlFor="serviceCategoryId" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Service Category (Optional)
                  </Label>
                  <Select
                    value={formData.serviceCategoryId}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, serviceCategoryId: value }))}
                  >
                    <SelectTrigger id="serviceCategoryId" className="h-11 rounded-xl text-sm font-medium">
                      <SelectValue placeholder="Select a service category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_SERVICE_CATEGORY}>All service categories</SelectItem>
                      {serviceCategories.map((sc) => (
                        <SelectItem key={sc.id} value={sc.id}>
                          {sc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Live Preview Placement Badge Box */}
              <div className="mt-4 p-4 rounded-xl bg-muted/40 border border-border/60 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-primary">Live Placement Target</span>
                <p className="text-xs text-foreground font-semibold">
                  {targetType === "product" && formData.categoryId === NONE_CATEGORY && formData.subcategoryId === NONE_SUBCATEGORY && (
                    "Shows on main Marketplace homepage carousel"
                  )}
                  {targetType === "product" && formData.categoryId !== NONE_CATEGORY && formData.subcategoryId === NONE_SUBCATEGORY && (
                    `Category: ${categories.find(c => c.id === formData.categoryId)?.name}`
                  )}
                  {targetType === "product" && formData.subcategoryId !== NONE_SUBCATEGORY && (
                    `Subcategory: ${subcategories.find(s => s.id === formData.subcategoryId)?.name}`
                  )}
                  {targetType === "service" && (formData.serviceCategoryId === NONE_SERVICE_CATEGORY || !formData.serviceCategoryId) && (
                    "Shows on main Services page carousel"
                  )}
                  {targetType === "service" && formData.serviceCategoryId !== NONE_SERVICE_CATEGORY && formData.serviceCategoryId && (
                    `Service Category: ${serviceCategories.find(sc => sc.id === formData.serviceCategoryId)?.name}`
                  )}
                  {targetType === "hotel" && (
                    "Shows on main Hotel & Resort booking page hero banner"
                  )}
                  {targetType === "restaurant" && (
                    "Shows on main Foods & Restaurant discovery page hero banner"
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="flex items-center justify-end gap-4 p-6 bg-card border border-border rounded-2xl shadow-sm w-full">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => router.push("/admin/banners")}
          className="rounded-xl border-border hover:bg-muted font-bold text-xs h-11 px-6"
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={loading} 
          className="rounded-xl font-extrabold text-xs h-11 px-8 shadow-md shadow-primary/20"
        >
          {loading ? "Saving..." : (banner ? "Update Banner" : "Create Banner")}
        </Button>
      </div>
    </form>
  );
}