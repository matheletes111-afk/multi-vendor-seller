import { prisma } from "./src/lib/prisma"

const imageMapping = [
  { keywords: ["pizza"], url: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500" },
  { keywords: ["pasta", "spaghetti", "fettuccine", "alfredo", "lasagna"], url: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500" },
  { keywords: ["burger", "sandwich", "wrap"], url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500" },
  { keywords: ["biryani", "rice", "naan", "tandoor", "paneer", "tikka", "masala", "kabab"], url: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500" },
  { keywords: ["wings", "chicken", "skewer", "meat", "salmon", "steak"], url: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=500" },
  { keywords: ["salad", "roll", "mushrooms", "green"], url: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500" },
  { keywords: ["sushi", "tempura", "ramen"], url: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=500" },
  { keywords: ["cake", "dessert", "sweet", "jamun", "churros", "tiramisu"], url: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500" },
  { keywords: ["fries", "bread", "breadsticks", "chips"], url: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=500" },
  { keywords: ["shake", "beverages", "juice", "drink", "soda"], url: "https://images.unsplash.com/photo-1536816579748-4fcb374350ec?w=500" }
]

async function main() {
  console.log("Updating food images in database with category-specific images...")
  
  const foods = await prisma.foodItem.findMany()
  console.log(`Found ${foods.length} total food items.`)
  
  let updatedCount = 0
  
  for (const food of foods) {
    const nameLower = food.name.toLowerCase()
    const descLower = food.description?.toLowerCase() || ""
    const categoryLower = food.category.toLowerCase()
    
    // Find matching category image
    let selectedImage = ""
    for (const mapping of imageMapping) {
      if (
        mapping.keywords.some(k => 
          nameLower.includes(k) || 
          descLower.includes(k) || 
          categoryLower.includes(k)
        )
      ) {
        selectedImage = mapping.url
        break
      }
    }
    
    // Fallback based on veg status
    if (!selectedImage) {
      selectedImage = food.isVeg 
        ? "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500"
        : "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500"
    }
    
    // Update the food item
    await prisma.foodItem.update({
      where: { id: food.id },
      data: {
        images: JSON.stringify([selectedImage])
      }
    })
    
    updatedCount++
  }
  
  console.log(`Successfully updated ${updatedCount} food items with beautiful custom images!`)
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
  })
