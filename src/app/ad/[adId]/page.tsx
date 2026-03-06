import { PublicLayout } from "@/components/site-layout";
import { AdPageClient } from "./ad-page-client";
import { PageLoader } from "@/components/ui/page-loader";
import { Suspense } from "react";

export default function AdPage() {
  return (
    <PublicLayout>
      <Suspense fallback={<PageLoader message="Loading…" />}>
        <AdPageClient />
      </Suspense>
    </PublicLayout>
  );
}
