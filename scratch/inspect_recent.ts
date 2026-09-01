import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const sellers = await prisma.seller.findMany({
    take: 20,
    include: {
      user: { select: { email: true, name: true, role: true, createdAt: true } },
      store: { select: { name: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  console.log(`--- MOST RECENT SELLERS IN DB ---`);
  sellers.forEach((s, idx) => {
    console.log(`${idx + 1}. [${s.type}] Store: "${s.store?.name || 'No Store'}" | Name: "${s.user.name}" | Email: ${s.user.email} | Created: ${s.createdAt.toISOString()}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
