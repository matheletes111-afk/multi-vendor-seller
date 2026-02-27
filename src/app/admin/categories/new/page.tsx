import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { CategoryForm } from "@/components/admin/category-form";

export default async function NewCategoryPage() {
  const session = await auth();
  
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard");
  }

  return (
    <div className="container mx-auto p-6 min-h-full bg-background text-foreground">
      <CategoryForm />
    </div>
  );
}