import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { isServiceSeller } from "@/lib/rbac"
import { formatCurrency } from "@/lib/utils"
import { serviceSellerLineGross } from "@/lib/service-seller-order-money"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { TrendingUp, FileText } from "lucide-react"

export const metadata = {
  title: "Net Worth | Dashboard",
  description: "View your credited net worth.",
}

export default async function NetWorthPage() {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) redirect("/service-seller/login")

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  })

  // If seller doesn't exist somehow, return empty
  if (!seller) return <div className="p-6">Seller not found</div>

  const serviceLines = await prisma.orderItem.findMany({
    where: {
      sellerId: seller.id,
      serviceId: { not: null },
    },
    select: {
      id: true,
      orderId: true,
      createdAt: true,
      subtotalInclGst: true,
      subtotal: true,
      gstAmount: true,
      shippingAmount: true,
      commissionAmount: true,
      serviceNameSnapshot: true,
      order: {
        select: { orderNumber: true }
      }
    },
    orderBy: { createdAt: "desc" },
  })

  // Total calculation just to show the final number at the top
  const sellerGrossTotal = serviceLines.reduce((s, i) => s + serviceSellerLineGross(i as any), 0)
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Net Worth Details</h1>
        <p className="text-muted-foreground mt-2">
          A full list of orders that contribute to your credited net worth. Platform fees are currently waived.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
         <Card className="md:col-span-1 border-blue-100 bg-blue-50/30">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-base font-semibold text-blue-900">Total Net Worth</CardTitle>
             <TrendingUp className="h-5 w-5 text-blue-700" />
           </CardHeader>
           <CardContent>
             <div className="text-3xl font-bold text-blue-950">
               {formatCurrency(sellerGrossTotal)}
             </div>
           </CardContent>
         </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
             <FileText className="w-5 h-5 text-muted-foreground" />
             Credited Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          {serviceLines.length > 0 ? (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b text-slate-500 font-medium">
                  <tr>
                    <th className="px-4 py-3 whitespace-nowrap">Order Number</th>
                    <th className="px-4 py-3">Service Name</th>
                    <th className="px-4 py-3 whitespace-nowrap">Date</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Credited Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {serviceLines.map((line) => {
                    const grossVal = serviceSellerLineGross(line as any)
                    return (
                      <tr key={line.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-900">#{line.order?.orderNumber || "Unknown"}</td>
                        <td className="px-4 py-3 text-slate-600 font-medium">{line.serviceNameSnapshot || "Service"}</td>
                        <td className="px-4 py-3 text-slate-600">{new Date(line.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-700">+{formatCurrency(grossVal)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
             <div className="py-8 text-center text-muted-foreground">
               No credited orders yet.
             </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
