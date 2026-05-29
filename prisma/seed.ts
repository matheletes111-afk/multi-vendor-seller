import { PrismaClient, SubscriptionPlan, PlanType } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding plans database...")

  // Create subscription plans for PRODUCT_SERVICE
  const freePlan = await prisma.plan.upsert({
    where: { name_type_duration: { name: SubscriptionPlan.FREE, type: PlanType.PRODUCT_SERVICE, duration: 30 } },
    update: {},
    create: {
      name: SubscriptionPlan.FREE,
      type: PlanType.PRODUCT_SERVICE,
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
    where: { name_type_duration: { name: SubscriptionPlan.STANDARD, type: PlanType.PRODUCT_SERVICE, duration: 30 } },
    update: {},
    create: {
      name: SubscriptionPlan.STANDARD,
      type: PlanType.PRODUCT_SERVICE,
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
    where: { name_type_duration: { name: SubscriptionPlan.PREMIUM, type: PlanType.PRODUCT_SERVICE, duration: 30 } },
    update: {},
    create: {
      name: SubscriptionPlan.PREMIUM,
      type: PlanType.PRODUCT_SERVICE,
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

  // Create subscription plans for HOTEL
  const hotelFreePlan = await prisma.plan.upsert({
    where: { name_type_duration: { name: SubscriptionPlan.FREE, type: PlanType.HOTEL, duration: 30 } },
    update: {},
    create: {
      name: SubscriptionPlan.FREE,
      type: PlanType.HOTEL,
      displayName: "Free Hotel Starter",
      description: "Perfect for listing your first hotel property",
      price: 0,
      maxProducts: 2, // Max 2 hotels
      maxOrders: 5,
      maxRooms: 10,   // Max 10 rooms
      features: {
        hotels: 2,
        rooms: 10,
        analytics: "basic",
        reviews: false,
        featured: false,
      },
    },
  })

  const hotelStandardPlan = await prisma.plan.upsert({
    where: { name_type_duration: { name: SubscriptionPlan.STANDARD, type: PlanType.HOTEL, duration: 30 } },
    update: {},
    create: {
      name: SubscriptionPlan.STANDARD,
      type: PlanType.HOTEL,
      displayName: "Standard Hotel",
      description: "Ideal for local boutique hotels",
      price: 39.99,
      maxProducts: 10,
      maxOrders: null,
      maxRooms: null, // Unlimited rooms
      features: {
        hotels: 10,
        rooms: "unlimited",
        analytics: "standard",
        reviews: true,
        featured: false,
      },
    },
  })

  const hotelPremiumPlan = await prisma.plan.upsert({
    where: { name_type_duration: { name: SubscriptionPlan.PREMIUM, type: PlanType.HOTEL, duration: 30 } },
    update: {},
    create: {
      name: SubscriptionPlan.PREMIUM,
      type: PlanType.HOTEL,
      displayName: "Premium Hotel",
      description: "For large hotel chains and resorts",
      price: 119.99,
      maxProducts: null,
      maxOrders: null,
      maxRooms: null, // Unlimited rooms
      features: {
        hotels: "unlimited",
        rooms: "unlimited",
        analytics: "advanced",
        reviews: true,
        featured: true,
        prioritySupport: true,
        customBranding: true,
      },
    },
  })

  // Create subscription plans for RESTAURANT
  const restaurantFreePlan = await prisma.plan.upsert({
    where: { name_type_duration: { name: SubscriptionPlan.FREE, type: PlanType.RESTAURANT, duration: 30 } },
    update: {},
    create: {
      name: SubscriptionPlan.FREE,
      type: PlanType.RESTAURANT,
      displayName: "Free Restaurant Starter",
      description: "Perfect for single outlet businesses",
      price: 0,
      maxProducts: 1, // Max 1 restaurant
      maxOrders: 15,
      features: {
        restaurants: 1,
        orders: 15,
        analytics: "basic",
        reviews: false,
        featured: false,
      },
    },
  })

  const restaurantStandardPlan = await prisma.plan.upsert({
    where: { name_type_duration: { name: SubscriptionPlan.STANDARD, type: PlanType.RESTAURANT, duration: 30 } },
    update: {},
    create: {
      name: SubscriptionPlan.STANDARD,
      type: PlanType.RESTAURANT,
      displayName: "Standard Restaurant",
      description: "Ideal for growing multi-outlet chains",
      price: 29.99,
      maxProducts: 5,
      maxOrders: null,
      features: {
        restaurants: 5,
        orders: "unlimited",
        analytics: "standard",
        reviews: true,
        featured: false,
      },
    },
  })

  const restaurantPremiumPlan = await prisma.plan.upsert({
    where: { name_type_duration: { name: SubscriptionPlan.PREMIUM, type: PlanType.RESTAURANT, duration: 30 } },
    update: {},
    create: {
      name: SubscriptionPlan.PREMIUM,
      type: PlanType.RESTAURANT,
      displayName: "Premium Restaurant",
      description: "For elite restaurants and culinary networks",
      price: 89.99,
      maxProducts: null,
      maxOrders: null,
      features: {
        restaurants: "unlimited",
        orders: "unlimited",
        analytics: "advanced",
        reviews: true,
        featured: true,
        prioritySupport: true,
        customBranding: true,
      },
    },
  })

  console.log("Plans seeding completed successfully!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
