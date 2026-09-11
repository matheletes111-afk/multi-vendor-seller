const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

async function main() {
  const order = await prisma.order.findUnique({
    where: { id: "cmtwk531e0004yw1v1ktdonv2" },
    include: {
      items: true,
      seller: true,
      deliveryAssignments: true,
    }
  })
  console.log(JSON.stringify(order, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
