const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const item = await prisma.orderItem.findUnique({
    where: { id: 'cmtwogncl00068grflj14dmm0' }
  });
  console.log({
    subtotal: item.subtotal,
    gstAmount: item.gstAmount,
    subtotalInclGst: item.subtotalInclGst,
    shippingAmount: item.shippingAmount,
    commissionAmount: item.commissionAmount,
    totalWithShipping: (item.subtotalInclGst || (item.subtotal + item.gstAmount)) + item.shippingAmount
  });
  await prisma.$disconnect();
}
run();
