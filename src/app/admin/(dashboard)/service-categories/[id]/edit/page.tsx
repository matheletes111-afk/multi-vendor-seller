import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { EditServiceCategoryClient } from "./edit-service-category-client";

export default async function EditServiceCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard");
  }
  const { id } = await params;
  return <EditServiceCategoryClient categoryId={id} />;
}
