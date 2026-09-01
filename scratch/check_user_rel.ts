import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const userId = "cmtiltbjq0000tz0z7jz84bbd";

  const accounts = await prisma.account.findMany({ where: { userId } });
  const sessions = await prisma.session.findMany({ where: { userId } });
  const addresses = await prisma.userAddress.findMany({ where: { userId } });
  const categoryInterests = await prisma.userCategoryInterest.findMany({ where: { userId } });

  console.log({
    accountsCount: accounts.length,
    sessionsCount: sessions.length,
    addressesCount: addresses.length,
    categoryInterestsCount: categoryInterests.length,
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
