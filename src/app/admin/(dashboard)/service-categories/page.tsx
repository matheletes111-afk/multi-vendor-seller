import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { ServiceCategoriesClient } from "./service-categories-client";

export default async function ServiceCategoriesPage() {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard");
  }
  return <ServiceCategoriesClient />;
}
