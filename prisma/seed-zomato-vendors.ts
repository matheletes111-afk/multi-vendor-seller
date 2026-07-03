import { PrismaClient, UserRole, OnboardingStatus } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding Zomato-style Restaurant Sellers and Menu Items...")

  const password = await bcrypt.hash("resto123", 10)

  // 1. Handle existing restaurant sellers in the DB
  const existingSellers = await prisma.restaurantSeller.findMany({
    include: {
      user: true,
      businessInfo: true,
      foods: true
    }
  })

  console.log(`Found ${existingSellers.length} existing restaurant sellers in DB.`)

  const sampleFoodCollections = [
    {
      category: "Starters",
      items: [
        { name: "Crispy Spring Rolls", price: 25.0, description: "Crispy fried rolls filled with fresh garden vegetables.", isVeg: true },
        { name: "Garlic Parmesan Wings", price: 45.0, description: "Succulent wings tossed in garlic parmesan dressing.", isVeg: false },
        { name: "Paneer Tikka Bites", price: 35.0, description: "Char-grilled marinated paneer cubes with mint chutney.", isVeg: true },
        { name: "Stuffed Mushrooms", price: 30.0, description: "Baked button mushrooms filled with spinach and cheese.", isVeg: true },
        { name: "Chicken Satay Skewers", price: 40.0, description: "Grilled chicken skewers served with peanut dip.", isVeg: false }
      ]
    },
    {
      category: "Mains",
      items: [
        { name: "Premium Butter Chicken", price: 75.0, description: "Tender chicken cooked in rich, creamy tomato butter gravy.", isVeg: false },
        { name: "Spaghetti Bolognese", price: 65.0, description: "Classic pasta cooked in slow-simmered beef ragu sauce.", isVeg: false },
        { name: "Paneer Butter Masala", price: 60.0, description: "Soft cottage cheese chunks in creamy spiced gravy.", isVeg: true },
        { name: "Grilled Salmon Steak", price: 110.0, description: "Fresh grilled salmon served with lemon herb butter sauce.", isVeg: false },
        { name: "Vegetable Dum Biryani", price: 50.0, description: "Aromatic basmati rice cooked with assortment of fresh veggies.", isVeg: true }
      ]
    },
    {
      category: "Fast Food",
      items: [
        { name: "Classic Cheese Overload Burger", price: 45.0, description: "Double beef patty with melted cheddar, lettuce, and pickles.", isVeg: false },
        { name: "Loaded Pepperoni Pizza", price: 70.0, description: "Freshly rolled crust topped with spicy pepperoni and mozzarella.", isVeg: false },
        { name: "Crispy French Fries Bowl", price: 20.0, description: "Golden crinkled fries sprinkled with sea salt.", isVeg: true },
        { name: "Cheesy Garlic Breadsticks", price: 28.0, description: "Baked breadsticks glazed with garlic butter and herbs.", isVeg: true },
        { name: "Spicy Chicken Wrap", price: 35.0, description: "Crispy chicken tenders, lettuce, and spicy chipotle sauce.", isVeg: false }
      ]
    }
  ]

  // Add 5 food items to each existing seller
  for (const seller of existingSellers) {
    if (seller.foods.length < 5) {
      console.log(`Adding foods to existing seller: ${seller.businessInfo?.businessName || seller.user.name}`)
      
      // Select a food collection (Starters or Mains or Fast Food)
      const collectionIndex = Math.floor(Math.random() * sampleFoodCollections.length)
      const collection = sampleFoodCollections[collectionIndex]

      for (const food of collection.items) {
        const existing = await prisma.foodItem.findFirst({
          where: { name: food.name, restaurantSellerId: seller.id }
        })
        if (!existing) {
          await prisma.foodItem.create({
            data: {
              restaurantSellerId: seller.id,
              name: food.name,
              description: food.description,
              price: food.price,
              category: collection.category,
              isVeg: food.isVeg,
              images: JSON.stringify(["https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500"]),
              isActive: true
            }
          })
        }
      }
    }
  }

  // 2. Create 5 New Approved Restaurant Sellers
  const newRestaurants = [
    {
      email: "resto_seller1@meeem.com",
      name: "Chef Marco",
      businessName: "Bella Italia Ristorante",
      cuisines: ["Italian", "Pasta", "Pizza"],
      foods: [
        { name: "Margherita Pizza Basilico", price: 55.0, description: "Neapolitan style crust with San Marzano tomatoes, fresh mozzarella, and fresh basil.", isVeg: true, category: "Pizza" },
        { name: "Fettuccine Alfredo with Chicken", price: 65.0, description: "Rich, creamy parmesan sauce tossed with fresh fettuccine and sliced chicken breast.", isVeg: false, category: "Pasta" },
        { name: "Tuscan Garlic Bread", price: 25.0, description: "Toasted artisanal bread rubbed with garlic, olive oil, and fresh rosemary.", isVeg: true, category: "Starters" },
        { name: "Classic Tiramisu Slice", price: 35.0, description: "Espresso-soaked ladyfingers layered with whipped mascarpone cream.", isVeg: true, category: "Dessert" },
        { name: "Lasagna al Forno", price: 75.0, description: "Layered fresh pasta sheets with slow-cooked beef bolognese and cheese.", isVeg: false, category: "Mains" }
      ]
    },
    {
      email: "resto_seller2@meeem.com",
      name: "Deepak Kumar",
      businessName: "Royal Biryani & Kababs",
      cuisines: ["Indian", "Biryani", "Halal"],
      foods: [
        { name: "Special Chicken Dum Biryani", price: 60.0, description: "Layered basmati rice and marinated chicken cooked slowly under charcoal seal.", isVeg: false, category: "Biryani" },
        { name: "Butter Paneer Masala", price: 50.0, description: "Fresh cottage cheese cooked in creamy sweet tomato and cashew gravy.", isVeg: true, category: "Mains" },
        { name: "Garlic Butter Naan", price: 15.0, description: "Freshly baked clay-oven flatbread topped with garlic and butter.", isVeg: true, category: "Bread" },
        { name: "Seekh Kabab Skewers (4pcs)", price: 45.0, description: "Spiced minced chicken cooked on skewers in a traditional tandoor oven.", isVeg: false, category: "Starters" },
        { name: "Gulab Jamun Sweet Cup (2pcs)", price: 20.0, description: "Warm milk dumplings fried and dipped in cardamom sugar syrup.", isVeg: true, category: "Dessert" }
      ]
    },
    {
      email: "resto_seller3@meeem.com",
      name: "Akihiro Tanaka",
      businessName: "Sakura Sushi Bar",
      cuisines: ["Japanese", "Sushi", "Asian"],
      foods: [
        { name: "Signature Salmon Roll (8pcs)", price: 80.0, description: "Fresh Norwegian salmon, cucumber, avocado, rolled with sesame seeds.", isVeg: false, category: "Sushi" },
        { name: "Chicken Gyoza Dumplings (6pcs)", price: 35.0, description: "Pan-fried Japanese chicken dumplings served with dipping sauce.", isVeg: false, category: "Starters" },
        { name: "Tonkotsu Ramen Bowl", price: 70.0, description: "Rich pork bone broth served with ramen noodles, chashu slices, egg, and green onion.", isVeg: false, category: "Mains" },
        { name: "Matcha Mochi Ice Cream (3pcs)", price: 30.0, description: "Sweet Japanese sticky rice balls filled with matcha green tea ice cream.", isVeg: true, category: "Dessert" },
        { name: "Veggie Tempura Basket", price: 40.0, description: "Light and crispy deep-fried carrot, sweet potato, and broccoli florets.", isVeg: true, category: "Starters" }
      ]
    },
    {
      email: "resto_seller4@meeem.com",
      name: "Sarah Jenkins",
      businessName: "Burger Bistro & Fries",
      cuisines: ["American", "Burgers", "Fast Food"],
      foods: [
        { name: "Chipotle BBQ Double Beef Burger", price: 65.0, description: "Two flame-grilled beef patties, cheddar, crispy onion rings, and smoky chipotle BBQ.", isVeg: false, category: "Burgers" },
        { name: "Golden Mozzarella Sticks", price: 30.0, description: "Deep-fried breaded cheese sticks served with warm marinara dipping sauce.", isVeg: true, category: "Starters" },
        { name: "Smoked Bacon Loaded Fries", price: 45.0, description: "Golden fries topped with cheese sauce, crispy bacon bits, and chopped chives.", isVeg: false, category: "Sides" },
        { name: "Oreo Overload Milkshake", price: 35.0, description: "Creamy vanilla ice cream blended with crushed oreo cookies and whipped cream.", isVeg: true, category: "Beverages" },
        { name: "Spicy Crispy Chicken Burger", price: 55.0, description: "Buttermilk fried chicken breast with hot sauce, lettuce, and mayo on brioche.", isVeg: false, category: "Burgers" }
      ]
    },
    {
      email: "resto_seller5@meeem.com",
      name: "Carlos Gomez",
      businessName: "Taco Loco Mexican Grill",
      cuisines: ["Mexican", "Tacos", "Spicy"],
      foods: [
        { name: "Flame Grilled Chicken Tacos (3pcs)", price: 50.0, description: "Soft corn tortillas with grilled chicken, fresh onion, cilantro, and lime salsa.", isVeg: false, category: "Tacos" },
        { name: "Grande Veggie Quesadilla", price: 45.0, description: "Grilled flour tortilla stuffed with mixed peppers, onions, and melted Monterey Jack.", isVeg: true, category: "Mains" },
        { name: "Tortilla Chips & Fresh Guac", price: 30.0, description: "Homemade crispy corn tortilla chips served with rich fresh avocado guacamole.", isVeg: true, category: "Starters" },
        { name: "Cinnamon Churros & Caramel", price: 25.0, description: "Crisp fried dough pastry sticks rolled in cinnamon sugar with caramel dipping.", isVeg: true, category: "Dessert" },
        { name: "Spicy Beef Burrito Wrap", price: 55.0, description: "Huge flour tortilla loaded with seasoned ground beef, rice, beans, sour cream, and salsa.", isVeg: false, category: "Mains" }
      ]
    }
  ]

  for (const r of newRestaurants) {
    console.log(`Creating restaurant seller user: ${r.email}`)
    
    // Create/find User
    const user = await prisma.user.upsert({
      where: { email: r.email },
      update: {},
      create: {
        email: r.email,
        name: r.name,
        password,
        role: UserRole.SELLER_RESTAURANT,
        emailVerified: new Date(),
        isEmailVerified: true
      }
    })

    // Create RestaurantSeller profile
    const seller = await prisma.restaurantSeller.upsert({
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
        primaryCuisine: JSON.stringify(r.cuisines)
      }
    })

    // Create Business Info
    await prisma.restaurantBusinessInfo.upsert({
      where: { restaurantSellerId: seller.id },
      update: {
        businessName: r.businessName,
        street: "100 Culinary Avenue",
        city: "Freetown",
        state: "Western Area"
      },
      create: {
        restaurantSellerId: seller.id,
        businessName: r.businessName,
        businessType: "Restaurant",
        street: "100 Culinary Avenue",
        city: "Freetown",
        state: "Western Area",
        landmark: "Gourmet Square"
      }
    })

    // Create KYC
    await prisma.restaurantKYC.upsert({
      where: { restaurantSellerId: seller.id },
      update: {},
      create: {
        restaurantSellerId: seller.id,
        idType: "National ID",
        idNumber: "ID" + Math.floor(100000 + Math.random() * 900000),
        foodLicenseNumber: "FL" + Math.floor(100000 + Math.random() * 900000)
      }
    })

    // Create Bank Details
    await prisma.restaurantBankDetails.upsert({
      where: { restaurantSellerId: seller.id },
      update: {},
      create: {
        restaurantSellerId: seller.id,
        bankName: "Culinary Merchant Bank",
        accountHolderName: r.name,
        accountNumber: "AC" + Math.floor(10000000 + Math.random() * 90000000)
      }
    })

    // Create Agreement
    await prisma.restaurantAgreement.upsert({
      where: { restaurantSellerId: seller.id },
      update: {},
      create: {
        restaurantSellerId: seller.id,
        agreedToTerms: true,
        agreedToCommission: true,
        agreedToPrivacy: true
      }
    })

    // Create foods
    for (const food of r.foods) {
      const existing = await prisma.foodItem.findFirst({
        where: { name: food.name, restaurantSellerId: seller.id }
      })
      if (!existing) {
        await prisma.foodItem.create({
          data: {
            restaurantSellerId: seller.id,
            name: food.name,
            description: food.description,
            price: food.price,
            category: food.category,
            isVeg: food.isVeg,
            images: JSON.stringify(["https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500"]),
            isActive: true
          }
        })
      }
    }
  }

  console.log("All restaurant sellers seeded successfully!")
}

main()
  .catch(e => {
    console.error("Seeding error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
