import { PrismaClient, UserRole, SubscriptionPlan } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding database...")

  // Create subscription plans
  const freePlan = await prisma.plan.upsert({
    where: { name: SubscriptionPlan.FREE },
    update: {},
    create: {
      name: SubscriptionPlan.FREE,
      displayName: "Free",
      description: "Perfect for getting started",
      price: 0,
      maxProducts: 5,
      maxOrders: 10,
      features: {
        products: 5,
        orders: 10,
        analytics: "basic",
        reviews: false,
        featured: false,
      },
    },
  })

  const standardPlan = await prisma.plan.upsert({
    where: { name: SubscriptionPlan.STANDARD },
    update: {},
    create: {
      name: SubscriptionPlan.STANDARD,
      displayName: "Standard",
      description: "For growing businesses",
      price: 29.99,
      maxProducts: 50,
      maxOrders: null, // unlimited
      features: {
        products: 50,
        orders: "unlimited",
        analytics: "standard",
        reviews: true,
        featured: false,
      },
    },
  })

  const premiumPlan = await prisma.plan.upsert({
    where: { name: SubscriptionPlan.PREMIUM },
    update: {},
    create: {
      name: SubscriptionPlan.PREMIUM,
      displayName: "Premium",
      description: "For established businesses",
      price: 99.99,
      maxProducts: null, // unlimited
      maxOrders: null, // unlimited
      features: {
        products: "unlimited",
        orders: "unlimited",
        analytics: "advanced",
        reviews: true,
        featured: true,
        prioritySupport: true,
        customBranding: true,
      },
    },
  })

  // Create admin user
  const hashedPassword = await bcrypt.hash("admin123", 10)
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "Admin User",
      password: hashedPassword,
      role: UserRole.ADMIN,
      emailVerified: new Date(),
    },
  })

  // Create categories
  const electronicsCategory = await prisma.category.upsert({
    where: { slug: "electronics" },
    update: {},
    create: {
      name: "Electronics",
      slug: "electronics",
      description: "Electronic products and gadgets",
      commissionRate: 10.0,
    },
  })

  const clothingCategory = await prisma.category.upsert({
    where: { slug: "clothing" },
    update: {},
    create: {
      name: "Clothing",
      slug: "clothing",
      description: "Apparel and fashion items",
      commissionRate: 12.0,
    },
  })

  const consultingCategory = await prisma.category.upsert({
    where: { slug: "consulting" },
    update: {},
    create: {
      name: "Consulting",
      slug: "consulting",
      description: "Professional consulting services",
      commissionRate: 15.0,
    },
  })

  const designCategory = await prisma.category.upsert({
    where: { slug: "design" },
    update: {},
    create: {
      name: "Design",
      slug: "design",
      description: "Design and creative services",
      commissionRate: 15.0,
    },
  })

  // Create test product sellers
  const productSeller1Password = await bcrypt.hash("seller123", 10)
  const productSeller1 = await prisma.user.upsert({
    where: { email: "productseller1@example.com" },
    update: {},
    create: {
      email: "productseller1@example.com",
      name: "Product Seller One",
      password: productSeller1Password,
      role: UserRole.SELLER_PRODUCT,
      emailVerified: new Date(),
    },
  })

  const seller1 = await prisma.seller.upsert({
    where: { userId: productSeller1.id },
    update: {},
    create: {
      userId: productSeller1.id,
      type: "PRODUCT",
      isApproved: true,
    },
  })

  await prisma.store.upsert({
    where: { sellerId: seller1.id },
    update: {},
    create: {
      sellerId: seller1.id,
      name: "Tech Store One",
      description: "Your one-stop shop for electronics and gadgets",
      address: "123 Tech Street",
      city: "San Francisco",
      state: "CA",
      zipCode: "94102",
      country: "USA",
      phone: "+1-555-0101",
    },
  })

  await prisma.subscription.upsert({
    where: { sellerId: seller1.id },
    update: {},
    create: {
      sellerId: seller1.id,
      planId: standardPlan.id,
      status: "ACTIVE",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    },
  })

  const productSeller2Password = await bcrypt.hash("seller123", 10)
  const productSeller2 = await prisma.user.upsert({
    where: { email: "productseller2@example.com" },
    update: {},
    create: {
      email: "productseller2@example.com",
      name: "Product Seller Two",
      password: productSeller2Password,
      role: UserRole.SELLER_PRODUCT,
      emailVerified: new Date(),
    },
  })

  const seller2 = await prisma.seller.upsert({
    where: { userId: productSeller2.id },
    update: {},
    create: {
      userId: productSeller2.id,
      type: "PRODUCT",
      isApproved: true,
    },
  })

  await prisma.store.upsert({
    where: { sellerId: seller2.id },
    update: {},
    create: {
      sellerId: seller2.id,
      name: "Fashion Boutique",
      description: "Trendy clothing and accessories",
      address: "456 Fashion Ave",
      city: "New York",
      state: "NY",
      zipCode: "10001",
      country: "USA",
      phone: "+1-555-0102",
    },
  })

  await prisma.subscription.upsert({
    where: { sellerId: seller2.id },
    update: {},
    create: {
      sellerId: seller2.id,
      planId: standardPlan.id,
      status: "ACTIVE",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })

  // Create test service sellers
  const serviceSeller1Password = await bcrypt.hash("seller123", 10)
  const serviceSeller1 = await prisma.user.upsert({
    where: { email: "serviceseller1@example.com" },
    update: {},
    create: {
      email: "serviceseller1@example.com",
      name: "Service Seller One",
      password: serviceSeller1Password,
      role: UserRole.SELLER_SERVICE,
      emailVerified: new Date(),
    },
  })

  const serviceSeller1Record = await prisma.seller.upsert({
    where: { userId: serviceSeller1.id },
    update: {},
    create: {
      userId: serviceSeller1.id,
      type: "SERVICE",
      isApproved: true,
    },
  })

  await prisma.store.upsert({
    where: { sellerId: serviceSeller1Record.id },
    update: {},
    create: {
      sellerId: serviceSeller1Record.id,
      name: "Consulting Pro",
      description: "Professional consulting services",
      address: "789 Business Blvd",
      city: "Chicago",
      state: "IL",
      zipCode: "60601",
      country: "USA",
      phone: "+1-555-0201",
    },
  })

  await prisma.subscription.upsert({
    where: { sellerId: serviceSeller1Record.id },
    update: {},
    create: {
      sellerId: serviceSeller1Record.id,
      planId: standardPlan.id,
      status: "ACTIVE",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })

  const serviceSeller2Password = await bcrypt.hash("seller123", 10)
  const serviceSeller2 = await prisma.user.upsert({
    where: { email: "serviceseller2@example.com" },
    update: {},
    create: {
      email: "serviceseller2@example.com",
      name: "Service Seller Two",
      password: serviceSeller2Password,
      role: UserRole.SELLER_SERVICE,
      emailVerified: new Date(),
    },
  })

  const serviceSeller2Record = await prisma.seller.upsert({
    where: { userId: serviceSeller2.id },
    update: {},
    create: {
      userId: serviceSeller2.id,
      type: "SERVICE",
      isApproved: true,
    },
  })

  await prisma.store.upsert({
    where: { sellerId: serviceSeller2Record.id },
    update: {},
    create: {
      sellerId: serviceSeller2Record.id,
      name: "Design Studio",
      description: "Creative design and branding services",
      address: "321 Creative Lane",
      city: "Los Angeles",
      state: "CA",
      zipCode: "90001",
      country: "USA",
      phone: "+1-555-0202",
    },
  })

  await prisma.subscription.upsert({
    where: { sellerId: serviceSeller2Record.id },
    update: {},
    create: {
      sellerId: serviceSeller2Record.id,
      planId: standardPlan.id,
      status: "ACTIVE",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })

  const serviceSeller3Password = await bcrypt.hash("seller123", 10)
  const serviceSeller3 = await prisma.user.upsert({
    where: { email: "serviceseller3@example.com" },
    update: {},
    create: {
      email: "serviceseller3@example.com",
      name: "Service Seller Three",
      password: serviceSeller3Password,
      role: UserRole.SELLER_SERVICE,
      emailVerified: new Date(),
    },
  })

  const serviceSeller3Record = await prisma.seller.upsert({
    where: { userId: serviceSeller3.id },
    update: {},
    create: {
      userId: serviceSeller3.id,
      type: "SERVICE",
      isApproved: true,
    },
  })

  await prisma.store.upsert({
    where: { sellerId: serviceSeller3Record.id },
    update: {},
    create: {
      sellerId: serviceSeller3Record.id,
      name: "Tech Support Services",
      description: "IT support and technical services",
      address: "654 Support Street",
      city: "Seattle",
      state: "WA",
      zipCode: "98101",
      country: "USA",
      phone: "+1-555-0203",
    },
  })

  await prisma.subscription.upsert({
    where: { sellerId: serviceSeller3Record.id },
    update: {},
    create: {
      sellerId: serviceSeller3Record.id,
      planId: standardPlan.id,
      status: "ACTIVE",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })

  console.log("Seed completed successfully!")
  console.log("\nTest Accounts Created:")
  console.log("Product Sellers:")
  console.log("  - productseller1@example.com / seller123")
  console.log("  - productseller2@example.com / seller123")
  console.log("Service Sellers:")
  console.log("  - serviceseller1@example.com / seller123")
  console.log("  - serviceseller2@example.com / seller123")
  console.log("  - serviceseller3@example.com / seller123")
  console.log("Admin:")
  console.log("  - admin@example.com / admin123")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

