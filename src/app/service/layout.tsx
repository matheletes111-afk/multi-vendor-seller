import { PublicLayout } from "@/components/site-layout"

export default function ServiceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <PublicLayout>{children}</PublicLayout>
}
