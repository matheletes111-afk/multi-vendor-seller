import { PrismaClient, UserRole, CreativeType, SellerAdStatus, OnboardingStatus } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding foods, banners, and ads...")

  // 1. Create/Find Restaurant Seller User
  const password = await bcrypt.hash("foodseller123", 10)
  const user = await prisma.user.upsert({
    where: { email: "foodseller@meeem.com" },
    update: {},
    create: {
      email: "foodseller@meeem.com",
      name: "Organic Chef Freetown",
      password,
      role: UserRole.SELLER_RESTAURANT,
      emailVerified: new Date()
    }
  })

  // 2. Create Restaurant Seller profile
  const restaurantSeller = await prisma.restaurantSeller.upsert({
    where: { userId: user.id },
    update: {
      isApproved: true,
      onboardingCompleted: true,
      status: OnboardingStatus.APPROVED
    },
    create: {
      userId: user.id,
      isApproved: true,
      onboardingCompleted: true,
      status: OnboardingStatus.APPROVED,
      estimateRestaurantCount: 1,
      serviceTypes: JSON.stringify(["Delivery", "Takeaway"]),
      primaryCuisine: JSON.stringify(["Salads", "Organic", "Juices"])
    }
  })

  // 3. Create Restaurant Business Info
  await prisma.restaurantBusinessInfo.upsert({
    where: { restaurantSellerId: restaurantSeller.id },
    update: {},
    create: {
      restaurantSellerId: restaurantSeller.id,
      businessName: "Green Harvest Organic Cafe",
      businessType: "Restaurant",
      street: "12 Cotton Tree Lane",
      city: "Freetown",
      state: "Western Area",
      landmark: "Opposite State House"
    }
  })

  // 4. Create Food Items under the Restaurant Seller
  const foods = [
    {
      name: "Fresh Avocado Salad Bowl",
      description: "Organic handpicked baby spinach, fresh avocados, cucumbers, cherry tomatoes, and house vinaigrette.",
      price: 45.0,
      category: "Salads",
      isVeg: true,
      images: JSON.stringify(["https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500"])
    },
    {
      name: "Gourmet Veggie Burger",
      description: "Premium black bean patty with crisp lettuce, fresh tomatoes, swiss cheese, and dynamic garlic aioli.",
      price: 65.0,
      category: "Burgers",
      isVeg: true,
      images: JSON.stringify(["https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500"])
    },
    {
      name: "Berry Chia Breakfast Cup",
      description: "Creamy vanilla chia seed pudding layered with wild fresh berries and organic honey drizzle.",
      price: 35.0,
      category: "Desserts",
      isVeg: true,
      images: JSON.stringify(["https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500"])
    },
    {
      name: "Detox Green Juice Extract",
      description: "Freshly pressed celery, spinach, ginger, lemon, and organic green apples.",
      price: 28.0,
      category: "Beverages",
      isVeg: true,
      images: JSON.stringify(["https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500"])
    },
    {
      name: "Quinoa Veggie Mix Bowl",
      description: "Nutritious warm red quinoa with roasted butternut squash, kale, pumpkin seeds, and tahini dressing.",
      price: 55.0,
      category: "Salads",
      isVeg: true,
      images: JSON.stringify(["https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500"])
    }
  ]

  for (const food of foods) {
    const existing = await prisma.foodItem.findFirst({
      where: { name: food.name, restaurantSellerId: restaurantSeller.id }
    })
    if (!existing) {
      await prisma.foodItem.create({
        data: {
          restaurantSellerId: restaurantSeller.id,
          name: food.name,
          description: food.description,
          price: food.price,
          category: food.category,
          isVeg: food.isVeg,
          images: food.images,
          isActive: true
        }
      })
    }
  }

  // 5. Create Banners
  const banners = [
    {
      bannerHeading: "Fresh Organic Harvest",
      bannerDescription: "20% off all salads, desserts, and fresh juices this week at Green Harvest.",
      bannerImage: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=1000",
      targetType: "restaurant"
    },
    {
      bannerHeading: "Boutique Hotel Escape",
      bannerDescription: "Indulge in royal luxury suites with complimentary organic breakfast vouchers.",
      bannerImage: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1000",
      targetType: "hotel"
    }
  ]

  for (const b of banners) {
    const existing = await prisma.banner.findFirst({
      where: { bannerHeading: b.bannerHeading, targetType: b.targetType }
    })
    if (!existing) {
      await prisma.banner.create({
        data: {
          bannerHeading: b.bannerHeading,
          bannerDescription: b.bannerDescription,
          bannerImage: b.bannerImage,
          targetType: b.targetType,
          isActive: true
        }
      })
    }
  }

  // 6. Create Ads for Food & Restaurant
  const foodItem = await prisma.foodItem.findFirst({ where: { name: "Fresh Avocado Salad Bowl" } })

  const now = new Date()
  const end = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days

  const ads = [
    {
      title: "Gourmet Avocado Salad Delivery",
      description: "Order freshly made organic avocado bowls, straight to your doorstep in Freetown.",
      creativeType: CreativeType.IMAGE,
      creativeUrl: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500",
      restaurantSellerId: restaurantSeller.id,
      foodItemId: foodItem?.id || null,
      status: SellerAdStatus.ACTIVE,
      totalBudget: 150.00,
      maxCpc: 0.50,
      startAt: now,
      endAt: end
    },
    {
      title: "Green Harvest Organic Cafe Specials",
      description: "Healthy dining and fresh detox extracts. Certified organic restaurant partner.",
      creativeType: CreativeType.IMAGE,
      creativeUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500",
      restaurantSellerId: restaurantSeller.id,
      status: SellerAdStatus.ACTIVE,
      totalBudget: 100.00,
      maxCpc: 0.40,
      startAt: now,
      endAt: end
    }
  ]

  for (const ad of ads) {
    const existing = await prisma.sellerAd.findFirst({
      where: { title: ad.title }
    })
    if (!existing) {
      await prisma.sellerAd.create({
        data: ad
      })
    }
  }

  // 7. Create Hotel Ads if any Hotel Seller exists (or fallback ad)
  const hotelSeller = await prisma.hotelSeller.findFirst()
  const hotel = await prisma.hotel.findFirst()

  const hotelAds = [
    {
      title: "Oceanfront Luxury Resort Stay",
      description: "Breathtaking ocean views, premium suites, and modern pool facilities.",
      creativeType: CreativeType.IMAGE,
      creativeUrl: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500",
      hotelSellerId: hotelSeller?.id || null,
      hotelId: hotel?.id || null,
      status: SellerAdStatus.ACTIVE,
      totalBudget: 200.00,
      maxCpc: 0.80,
      startAt: now,
      endAt: end
    }
  ]

  for (const ad of hotelAds) {
    const existing = await prisma.sellerAd.findFirst({
      where: { title: ad.title }
    })
    if (!existing) {
      await prisma.sellerAd.create({
        data: ad
      })
    }
  }

  console.log("Seeding completed successfully!")
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
