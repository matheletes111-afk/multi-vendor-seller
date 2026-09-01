import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const targetEmail = "debhohi2014@gmail.com";
  const partial = "debhohi";

  console.log(`\n🔍 Searching for email: ${targetEmail} (and pattern: ${partial})...\n`);

  // 1. Exact match in User
  const exactUser = await prisma.user.findUnique({
    where: { email: targetEmail },
    include: {
      seller: {
        include: {
          store: true,
          businessInfo: true,
          kyc: true,
          bankDetails: true,
          agreement: true,
        }
      },
      hotelSeller: true,
      restaurantSeller: true,
      rider: true,
      addresses: true,
      orders: true,
    }
  });

  if (exactUser) {
    console.log("✅ EXACT USER FOUND in DB:");
    console.log(JSON.stringify(exactUser, null, 2));
    return;
  }

  console.log("❌ No exact match found for " + targetEmail);

  // 2. Case-insensitive / partial match in User
  const partialUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: partial, mode: "insensitive" } },
        { name: { contains: partial, mode: "insensitive" } },
        { email: { contains: "deb", mode: "insensitive" } }
      ]
    },
    include: {
      seller: {
        include: {
          store: true
        }
      }
    }
  });

  console.log(`\n🔎 Partial matches in Users (${partialUsers.length} found):`);
  partialUsers.forEach((u, i) => {
    console.log(`${i + 1}. [${u.role}] ${u.name} | ${u.email} | Created: ${u.createdAt.toISOString()} | Seller: ${u.seller ? 'YES' : 'NO'}`);
  });

  // 3. Search in stores or business info
  const storeMatches = await prisma.store.findMany({
    where: {
      name: { contains: partial, mode: "insensitive" }
    },
    include: { seller: { include: { user: true } } }
  });

  if (storeMatches.length > 0) {
    console.log(`\n🏬 Store matches (${storeMatches.length}):`);
    storeMatches.forEach(s => {
      console.log(`Store: ${s.name} | Seller User: ${s.seller.user.email}`);
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
