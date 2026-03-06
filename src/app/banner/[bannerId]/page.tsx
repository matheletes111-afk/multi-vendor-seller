import { PublicLayout } from "@/components/site-layout";
import { BannerPageClient } from "./banner-page-client";
import { PageLoader } from "@/components/ui/page-loader";
import { Suspense } from "react";

export default function BannerPage() {
  return (
    <PublicLayout>
      <Suspense fallback={<PageLoader message="Loading…" />}>
        <BannerPageClient />
      </Suspense>
    </PublicLayout>
  );
}
