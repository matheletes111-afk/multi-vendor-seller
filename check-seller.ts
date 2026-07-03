import { prisma } from "@/lib/prisma"

async function main() {
  const sellerId = "cmp2bvfhi0004z5tfwwaw5abj"
  console.log("Checking RestaurantSeller ID:", sellerId)
  
  const seller = await prisma.restaurantSeller.findUnique({
    where: { id: sellerId },
    include: {
      user: true,
      businessInfo: true
    }
  })
  
  if (!seller) {
    console.log("No seller found with this ID.")
  } else {
    console.log("Seller record details:")
    console.log("ID:", seller.id)
    console.log("userId:", seller.userId)
    console.log("isApproved:", seller.isApproved)
    console.log("isSuspended:", seller.isSuspended)
    console.log("Business Name:", seller.businessInfo?.businessName)
    console.log("User Email:", seller.user?.email)
  }
}

main().catch(console.error)
