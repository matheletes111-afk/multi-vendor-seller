import { PrismaClient, UserRole, SubscriptionPlan } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding database...")

  // Create subscription plans
  const freePlan = await prisma.subscriptionPlan.upsert({
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

  const standardPlan = await prisma.subscriptionPlan.upsert({
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

  const premiumPlan = await prisma.subscriptionPlan.upsert({
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

  console.log("Seed completed successfully!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

