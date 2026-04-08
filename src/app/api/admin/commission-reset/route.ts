import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [productCategories, serviceCategories] = await Promise.all([
      prisma.category.updateMany({
        data: { commissionRate: 0 }
      }),
      prisma.serviceCategory.updateMany({
        data: { commissionRate: 0 }
      })
    ]);

    return NextResponse.json({
      message: "Commission rates reset successfully",
      stats: {
        productCategories: productCategories.count,
        serviceCategories: serviceCategories.count
      }
    });
  } catch (error: any) {
    console.error("Error resetting commissions:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
