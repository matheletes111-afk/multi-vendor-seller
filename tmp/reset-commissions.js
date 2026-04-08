const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Resetting all commissions to 0...");
  
  const productCount = await prisma.category.updateMany({
    data: { commissionRate: 0 }
  });
  console.log(`Updated ${productCount.count} product categories.`);
  
  const serviceCount = await prisma.serviceCategory.updateMany({
    data: { commissionRate: 0 }
  });
  console.log(`Updated ${serviceCount.count} service categories.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
