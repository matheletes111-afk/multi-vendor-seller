import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"

export async function GET(request: NextRequest) {
  try {
    const authResult = await getMobileCustomerAuth(request)
    const userId = authResult.ok ? authResult.userId : null

    // 1. Dynamic Fetch Active Delivery Address from Prisma UserAddress model
    let activeAddress = null
    if (userId) {
      const userAddr = await prisma.userAddress.findFirst({
        where: { userId },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      })
      if (userAddr) {
        activeAddress = {
          id: userAddr.id,
          label: `${userAddr.addressType === "HOME" ? "Deliver to Home" : userAddr.addressType === "OFFICE" ? "Deliver to Office" : "Deliver to"} - ${userAddr.addressLine1}`,
          street: userAddr.addressLine1,
          city: userAddr.city,
          state: userAddr.state,
          country: userAddr.country,
          postalCode: userAddr.postalCode,
          latitude: userAddr.latitude ?? null,
          longitude: userAddr.longitude ?? null,
          is_default: userAddr.isDefault,
          is_guest_fallback: false,
        }
      }
    }
    if (!activeAddress) {
      activeAddress = {
        id: "guest_default",
        label: "Deliver to Silicon Oasis",
        street: "Silicon Oasis",
        city: "Dubai",
        state: "Dubai",
        country: "UAE",
        postalCode: "00000",
        is_default: true,
        is_guest_fallback: true,
      }
    }

    // 2. Dynamic Notifications Unread Count from Prisma active Order, FoodOrder, and HotelBooking models
    let unreadCount = 0
    if (userId) {
      const [activeProductOrders, activeFoodOrders, activeHotelBookings] = await Promise.all([
        prisma.order.count({
          where: {
            customerId: userId,
            status: { in: ["CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY"] },
          },
        }),
        prisma.foodOrder.count({
          where: {
            customerId: userId,
            status: { in: ["CONFIRMED", "PROCESSING", "OUT_FOR_DELIVERY"] },
          },
        }),
        prisma.hotelBooking.count({
          where: {
            userId,
            status: { in: ["PENDING", "CONFIRMED"] },
          },
        }),
      ])
      unreadCount = activeProductOrders + activeFoodOrders + activeHotelBookings
    }

    // 3. Category Navigation Links
    const quickCategories = [
      { id: "cat_all", name: "All", icon_url: "/icons/all.png", category_type: "ALL", deep_link: "/browse" },
      { id: "cat_products", name: "Shopping", icon_url: "/icons/product.png", category_type: "PRODUCT", deep_link: "/mobileapi/v1/categories/products" },
      { id: "cat_food", name: "Food & Dining", icon_url: "/icons/food.png", category_type: "FOOD", deep_link: "/mobileapi/v1/categories/food" },
      { id: "cat_services", name: "Services", icon_url: "/icons/service.png", category_type: "SERVICE", deep_link: "/mobileapi/v1/categories/services" },
      { id: "cat_hotels", name: "Dubai Stays", icon_url: "/icons/hotel.png", category_type: "HOTEL", deep_link: "/mobileapi/v1/categories/hotels" },
    ]

    // Construct the BFF layout structure using /mobileapi/v1 endpoints
    const layoutSections = [
      {
        type: "HEADER_LOCATION",
        data: activeAddress,
      },
      {
        type: "NOTIFICATION_COUNT",
        data: { unread_count: unreadCount, has_critical: false },
      },
      {
        type: "QUICK_CATEGORIES",
        data: quickCategories,
      },
      {
        type: "HERO_CAROUSEL",
        endpoint: "/mobileapi/v1/banners?placement=home_hero",
      },
      {
        type: "DISCOUNTED_PRODUCTS",
        title: "Shop Products - Up to 50% Off",
        endpoint: "/mobileapi/v1/products/promotions?type=discount&max_discount=50",
      },
      {
        type: "SPONSORED_SPOTLIGHT_1",
        endpoint: "/mobileapi/v1/ads/spotlight?slot=home_mid_1",
      },
      {
        type: "SERVICES_UNDER_PRICE",
        title: "Best Service under NLe 99",
        endpoint: "/mobileapi/v1/services/promotions?max_price=99",
      },
      {
        type: "SHOP_BY_CATEGORY",
        title: "Shop by Category",
        endpoint: "/mobileapi/v1/categories/featured?limit=4",
      },
      {
        type: "CONTINUE_SEARCH",
        title: "Continue your search",
        endpoint: "/mobileapi/v1/user/recent-searches",
      },
      {
        type: "MEGA_SALE_BANNER",
        endpoint: "/mobileapi/v1/banners?placement=home_mid_banner",
      },
      {
        type: "DEALS_OF_THE_DAY",
        title: "Deals of the Day",
        endpoint: "/mobileapi/v1/deals/products?limit=10",
      },
      {
        type: "NEARBY_RESTAURANTS",
        title: "Food spots near you",
        endpoint: "/mobileapi/v1/restaurants/nearby",
      },
      {
        type: "EXPERT_SERVICES",
        title: "Expert Services",
        endpoint: "/mobileapi/v1/services/featured-home-services",
      },
      {
        type: "SPONSORED_SPOTLIGHT_2",
        endpoint: "/mobileapi/v1/ads/spotlight?slot=home_mid_2",
      },
      {
        type: "NEARBY_HOTELS",
        title: "Hotels near you",
        endpoint: "/mobileapi/v1/hotels/nearby",
      },
      {
        type: "HOTEL_PROMO_BANNER",
        endpoint: "/mobileapi/v1/banners?placement=home_hotels_promo",
      },
      {
        type: "RECOMMENDED_GRID",
        title: "Recommended for you",
        endpoint: "/mobileapi/v1/recommendations/feed?page=1",
      },
    ]

    return NextResponse.json({
      success: true,
      data: {
        sections: layoutSections,
      },
    })
  } catch (error) {
    console.error("Home layout API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
