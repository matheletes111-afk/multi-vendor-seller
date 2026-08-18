import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient({
  log: ["error"],
})

// Deterministic brand mapping helper based on product name and category
function getBrandForProduct(productName: string, categorySlug?: string | null, categoryName?: string | null): string {
  const name = (productName || "").toLowerCase()
  const cat = (categorySlug || categoryName || "").toLowerCase()

  // 1. Direct name match heuristics
  if (name.includes("apple") || name.includes("iphone") || name.includes("macbook") || name.includes("ipad")) return "Apple"
  if (name.includes("samsung") || name.includes("galaxy")) return "Samsung"
  if (name.includes("sony") || name.includes("playstation")) return "Sony"
  if (name.includes("nike") || name.includes("air max") || name.includes("running sneakers") || name.includes("sneaker")) return "Nike"
  if (name.includes("adidas") || name.includes("ultraboost")) return "Adidas"
  if (name.includes("puma")) return "Puma"
  if (name.includes("levi") || name.includes("denim") || name.includes("jean")) return "Levi's"
  if (name.includes("t-shirt") || name.includes("wallet") || name.includes("leather") || name.includes("shirt") || name.includes("dress")) return "Zara"
  if (name.includes("usb-c") || name.includes("earbuds") || name.includes("phone stand") || name.includes("charger") || name.includes("adapter") || name.includes("cable")) return "Anker"
  if (name.includes("laptop") || name.includes("computer") || name.includes("desktop") || name.includes("monitor")) return "Dell"
  if (name.includes("milk") || name.includes("yogurt") || name.includes("dairy") || name.includes("chocolate") || name.includes("coffee")) return "Nestlé"
  if (name.includes("juice") || name.includes("beverage") || name.includes("orange")) return "Tropicana"
  if (name.includes("honey") || name.includes("oil") || name.includes("bread") || name.includes("croissant") || name.includes("egg") || name.includes("salad") || name.includes("almond") || name.includes("organic")) return "Organic Valley"
  if (name.includes("cream") || name.includes("lotion") || name.includes("moisturizing") || name.includes("soap")) return "Nivea"
  if (name.includes("shampoo") || name.includes("conditioner") || name.includes("hair") || name.includes("lipstick") || name.includes("serum")) return "L'Oréal"
  if (name.includes("vase") || name.includes("cutlery") || name.includes("furniture") || name.includes("hose") || name.includes("decor") || name.includes("table")) return "IKEA"
  if (name.includes("yoga") || name.includes("mat") || name.includes("fitness") || name.includes("gym") || name.includes("dumbbell")) return "Decathlon"
  if (name.includes("camping") || name.includes("flashlight") || name.includes("torch") || name.includes("tent") || name.includes("backpack")) return "Coleman"
  if (name.includes("notebook") || name.includes("journal") || name.includes("diary")) return "Moleskine"
  if (name.includes("pencil") || name.includes("pen") || name.includes("sketch") || name.includes("marker") || name.includes("paper")) return "Faber-Castell"
  if (name.includes("toy") || name.includes("lego") || name.includes("brick") || name.includes("doll") || name.includes("puzzle")) return "LEGO"

  // 2. Category-based fallback
  if (cat.includes("electronic") || cat.includes("gadget") || cat.includes("phone")) return "Sony"
  if (cat.includes("fashion") || cat.includes("clothing") || cat.includes("apparel") || cat.includes("shoe")) return "H&M"
  if (cat.includes("grocery") || cat.includes("food") || cat.includes("snack")) return "Nestlé"
  if (cat.includes("beauty") || cat.includes("care") || cat.includes("cosmetic") || cat.includes("makeup")) return "L'Oréal"
  if (cat.includes("home") || cat.includes("garden") || cat.includes("kitchen")) return "IKEA"
  if (cat.includes("sport") || cat.includes("fitness") || cat.includes("outdoor")) return "Nike"
  if (cat.includes("book") || cat.includes("stationery")) return "Oxford"
  if (cat.includes("auto")) return "Bosch"
  if (cat.includes("toy") || cat.includes("kid") || cat.includes("baby")) return "Mattel"
  if (cat.includes("health") || cat.includes("wellness")) return "Centrum"

  return "Generic"
}

async function main() {
  console.log("🔍 Scanning products to seed dynamic brand attributes...")

  const products = await prisma.product.findMany({
    include: {
      category: true,
      variants: true,
    },
  })

  console.log(`Found ${products.length} products. Processing variant brand updates in batches...`)

  const updates: { id: string; attributes: any; brand: string }[] = []
  const brandFrequency: Record<string, number> = {}

  for (const p of products) {
    const assignedBrand = getBrandForProduct(p.name, p.category?.slug, p.category?.name)
    brandFrequency[assignedBrand] = (brandFrequency[assignedBrand] || 0) + 1

    for (const v of p.variants) {
      const existingAttrs =
        v.attributes && typeof v.attributes === "object" && !Array.isArray(v.attributes)
          ? (v.attributes as Record<string, unknown>)
          : {}

      const currentBrand = (existingAttrs.brand ?? existingAttrs.Brand ?? existingAttrs.BRAND) as string | undefined
      const finalBrand = typeof currentBrand === "string" && currentBrand.trim() && currentBrand.trim().toLowerCase() !== "other"
        ? currentBrand.trim()
        : assignedBrand

      updates.push({
        id: v.id,
        attributes: {
          ...existingAttrs,
          brand: finalBrand,
        },
        brand: finalBrand,
      })
    }
  }

  // Execute in batches of 25 with small delay to prevent connection saturation
  const BATCH_SIZE = 25
  let completed = 0

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const chunk = updates.slice(i, i + BATCH_SIZE)
    await Promise.all(
      chunk.map((item) =>
        prisma.productVariant.update({
          where: { id: item.id },
          data: { attributes: item.attributes },
        }).catch((err) => {
          console.error(`Failed variant ${item.id}:`, err.message)
        })
      )
    )
    completed += chunk.length
    process.stdout.write(`\rProgress: ${completed}/${updates.length} variants updated...`)
  }

  console.log(`\n\n✅ Successfully completed brand seeding for ${updates.length} variants across ${products.length} products!`)
  console.log("\n📊 Seeded Brand Distribution:")
  Object.entries(brandFrequency)
    .sort((a, b) => b[1] - a[1])
    .forEach(([brand, count]) => {
      console.log(`   - ${brand}: ${count} products`)
    })
}

main()
  .catch((e) => {
    console.error("❌ Error seeding product brands:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
