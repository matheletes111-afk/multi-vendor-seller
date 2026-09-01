import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.count();
  const sellers = await prisma.seller.findMany({
    include: {
      user: { select: { email: true, name: true, role: true, createdAt: true } },
      store: { select: { name: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  console.log(`\n📊 DATABASE SUMMARY:`);
  console.log(`Total Users in DB: ${users}`);
  console.log(`Total Sellers in DB: ${sellers.length}\n`);

  console.log(`--- CURRENT SELLERS ---`);
  sellers.forEach((s, idx) => {
    console.log(`${idx + 1}. [${s.type}] ${s.store?.name || 'No Store'} | User: ${s.user.name || s.user.email} (${s.user.email}) | Created: ${s.createdAt.toISOString()}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
