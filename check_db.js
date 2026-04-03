const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

async function main() {
  const sellers = await prisma.seller.findMany({
    where: { type: "SERVICE" },
    include: {
      selectedServiceCategories: true,
      selectedCategories: true,
      store: true
    }
  })
  console.log(JSON.stringify(sellers, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
