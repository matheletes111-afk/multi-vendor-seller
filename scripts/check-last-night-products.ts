import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Let's define the time window for "last night"
  // Current time: Sep 29, 2026 ~12:30 PM IST (07:00 UTC)
  // Last night in IST:
  // Sep 28 evening (e.g. from 18:00 IST / 12:30 UTC) to Sep 29 morning (06:00 or 12:00 IST)
  // Let's fetch all products created from Sep 28 00:00:00 IST (Sep 27 18:30:00 UTC) to now
  const since = new Date("2026-09-28T00:00:00.000+05:30");

  const products = await prisma.product.findMany({
    where: {
      createdAt: {
        gte: since,
      },
    },
    include: {
      seller: {
        include: {
          user: true,
          store: true,
        },
      },
      category: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  console.log(`\n======================================================`);
  console.log(`TOTAL PRODUCTS CREATED SINCE YESTERDAY (${since.toISOString()}): ${products.length}`);
  console.log(`======================================================\n`);

  // Group by seller
  const sellerSummary: Record<
    string,
    {
      sellerId: string;
      sellerName: string;
      sellerEmail: string;
      storeName: string;
      productCount: number;
      firstUploadIST: string;
      lastUploadIST: string;
      products: { id: string; name: string; createdAtIST: string }[];
    }
  > = {};

  for (const p of products) {
    const sId = p.sellerId;
    const istTime = new Date(p.createdAt.getTime() + 5.5 * 60 * 60 * 1000)
      .toISOString()
      .replace("Z", " IST")
      .replace("T", " ");

    if (!sellerSummary[sId]) {
      sellerSummary[sId] = {
        sellerId: sId,
        sellerName: p.seller?.user?.name || "N/A",
        sellerEmail: p.seller?.user?.email || "N/A",
        storeName: p.seller?.store?.name || "N/A",
        productCount: 0,
        firstUploadIST: istTime,
        lastUploadIST: istTime,
        products: [],
      };
    }

    sellerSummary[sId].productCount++;
    sellerSummary[sId].lastUploadIST = istTime;
    sellerSummary[sId].products.push({
      id: p.id,
      name: p.name,
      createdAtIST: istTime,
    });
  }

  // Display summary
  console.log("SELLER SUMMARY (Uploaded Since Yesterday):");
  console.log(JSON.stringify(
    Object.values(sellerSummary).map(s => ({
      sellerId: s.sellerId,
      sellerName: s.sellerName,
      sellerEmail: s.sellerEmail,
      storeName: s.storeName,
      productCount: s.productCount,
      firstUpload: s.firstUploadIST,
      lastUpload: s.lastUploadIST,
      productSample: s.products.slice(0, 5).map(x => x.name),
    })),
    null,
    2
  ));

  // Also check if any food items were uploaded since yesterday
  try {
    const foodItems = await prisma.foodItem.findMany({
      where: { createdAt: { gte: since } },
      include: {
        restaurantSeller: {
          include: {
            user: true,
            businessInfo: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    console.log(`\nFOOD ITEMS CREATED SINCE YESTERDAY: ${foodItems.length}`);
    if (foodItems.length > 0) {
      console.log(
        foodItems.map(f => ({
          name: f.name,
          createdAt: f.createdAt,
          restaurant: f.restaurantSeller?.businessInfo?.businessName,
          sellerEmail: f.restaurantSeller?.user?.email,
        }))
      );
    }
  } catch (e: any) {
    console.error("FoodItem check failed:", e.message);
  }

  // Also check if any services were uploaded since yesterday
  try {
    const services = await prisma.service.findMany({
      where: { createdAt: { gte: since } },
      include: {
        seller: {
          include: {
            user: true,
            store: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    console.log(`\nSERVICES CREATED SINCE YESTERDAY: ${services.length}`);
    if (services.length > 0) {
      console.log(
        services.map(s => ({
          name: s.name,
          createdAt: s.createdAt,
          sellerEmail: s.seller?.user?.email,
          storeName: s.seller?.store?.name,
        }))
      );
    }
  } catch (e: any) {
    console.error("Service check failed:", e.message);
  }

  // Specifically breakdown by time ranges:
  // 1. Last night (Sep 28 18:00 IST to Sep 29 06:00 IST)
  // 2. Late night (Sep 28 20:00 IST to Sep 29 04:00 IST)
  // 3. Early morning today (Sep 29 06:00 IST to 12:00 IST)
  console.log("\n--- HOURLY BREAKDOWN OF PRODUCT UPLOADS (IST) ---");
  const hourlyCount: Record<string, number> = {};
  for (const p of products) {
    const istDate = new Date(p.createdAt.getTime() + 5.5 * 60 * 60 * 1000);
    const hourKey = istDate.toISOString().slice(0, 13) + ":00 IST";
    hourlyCount[hourKey] = (hourlyCount[hourKey] || 0) + 1;
  }
  console.table(hourlyCount);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
