const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const tx = await prisma.sellerBalanceTransaction.findMany({
    where: { orderItemId: 'cmtwogncl00068grflj14dmm0' }
  });
  console.log('Balance transactions:', tx);
  await prisma.$disconnect();
}
run();
