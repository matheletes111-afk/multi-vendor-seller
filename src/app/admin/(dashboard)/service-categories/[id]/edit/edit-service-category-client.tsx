"use client";

import { useState, useEffect } from "react";
import { notFound } from "next/navigation";
import { ServiceCategoryForm } from "@/components/admin/service-category-form";
import { PageLoader } from "@/components/ui/page-loader";

export function EditServiceCategoryClient({ categoryId }: { categoryId: string }) {
  const [category, setCategory] = useState<{
    id: string;
    name: string;
    description: string | null;
    image: string | null;
    mobileIcon: string | null;
    commissionRate: number;
    isActive: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/service-categories/${categoryId}`)
      .then((res) => {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error("Failed to fetch service category");
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setCategory(json);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  if (loading && !category) {
    return <PageLoader message="Loading service category…" />;
  }
  if (error || !category) {
    notFound();
  }
  return (
    <div className="container mx-auto p-6 min-h-full bg-background text-foreground">
      <ServiceCategoryForm category={category} />
    </div>
  );
}
