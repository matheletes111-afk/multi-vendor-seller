export interface DripTemplateItem {
  sellerType: "PRODUCT" | "SERVICE" | "HOTEL" | "RESTAURANT"
  dayNumber: number
  subject: string
  preheader: string
  headline: string
  body: string
  bulletPoints: string[]
  ctaText: string
  ctaUrl: string
  isActive?: boolean
}

export const DEFAULT_DRIP_TEMPLATES: DripTemplateItem[] = [
  // ==========================================
  // 🛍️ 1. PRODUCT SELLER (Days 1 to 7)
  // ==========================================
  {
    sellerType: "PRODUCT",
    dayNumber: 1,
    subject: "🚀 Welcome to MEEEM! Set Up Your Product Storefront Today",
    preheader: "Start selling to thousands of shoppers across the country",
    headline: "Welcome to MEEEM Marketplace!",
    body: "We are thrilled to have you join MEEEM as a verified merchant. Your digital storefront is your gateway to reaching eager customers every single day. Completing your store setup takes just a few minutes and opens up powerful eCommerce tools built for your growth.",
    bulletPoints: [
      "Custom storefront name, banner, and logo branding",
      "Instant access to vendor dashboard and live analytics",
      "Zero upfront setup fees or listing charges",
    ],
    ctaText: "Set Up Storefront Now →",
    ctaUrl: "/product-seller/dashboard",
    isActive: true,
  },
  {
    sellerType: "PRODUCT",
    dayNumber: 2,
    subject: "📦 Time for Your First Upload! Add Products & Attract Buyers",
    preheader: "Products with detailed descriptions get 3x more orders",
    headline: "Add Your First Product to the Catalog",
    body: "Your store is ready—now it is time to stock your virtual shelves! Listing your first product is quick and straightforward. Enter your product title, category, price, and upload clear photos to make your listing shine.",
    bulletPoints: [
      "Add single products or bulk inventory easily",
      "Categorize your products for top search ranking",
      "Real-time stock tracking and inventory management",
    ],
    ctaText: "Upload First Product →",
    ctaUrl: "/product-seller/products/create",
    isActive: true,
  },
  {
    sellerType: "PRODUCT",
    dayNumber: 3,
    subject: "✨ Promotional Advantage: Enjoy 0% Extra Listing Fees",
    preheader: "Maximize your profit margins with MEEEM vendor benefits",
    headline: "Keep More Profits in Your Pocket",
    body: "At MEEEM, we believe local merchants should thrive. That is why we offer promotional introductory perks and transparent low commissions, ensuring that when you make a sale, you retain the vast majority of your revenue.",
    bulletPoints: [
      "No hidden monthly charges or surprise deductions",
      "Transparent commission structure on completed orders only",
      "Free product promotion across MEEEM mobile apps",
    ],
    ctaText: "View Vendor Perks & Upload →",
    ctaUrl: "/product-seller/products",
    isActive: true,
  },
  {
    sellerType: "PRODUCT",
    dayNumber: 4,
    subject: "📸 Pro Seller Tip: 3 Secrets to High-Converting Product Photos",
    preheader: "Simple photography tips that increase sales by 45%",
    headline: "Make Your Products Impossible to Resist",
    body: "Shoppers buy with their eyes! Clear, well-lit photos build trust and dramatically reduce customer hesitation. You do not need professional equipment—a modern smartphone and natural daylight are all you need.",
    bulletPoints: [
      "Use bright, natural daylight without harsh shadows",
      "Capture multiple angles (front, back, details, scale)",
      "Show the product in actual use or on a clean plain background",
    ],
    ctaText: "Enhance Your Product Catalog →",
    ctaUrl: "/product-seller/products",
    isActive: true,
  },
  {
    sellerType: "PRODUCT",
    dayNumber: 5,
    subject: "💳 Fast & Secure Payouts: Direct to Mobile Money or Bank",
    preheader: "Never worry about cashflow with fast settlement cycles",
    headline: "Get Paid Smoothly & On Time",
    body: "Cashflow is the lifeblood of your business. MEEEM provides automated, secure payout settlements directly to your preferred payout method, whether it is Orange Money, Africell Money, or your commercial bank account.",
    bulletPoints: [
      "Integrated local Mobile Money (Orange, Africell) & Bank transfer",
      "Transparent digital invoices and payout receipts",
      "Automated settlements without manual follow-up",
    ],
    ctaText: "Verify Payout Details →",
    ctaUrl: "/product-seller/settings",
    isActive: true,
  },
  {
    sellerType: "PRODUCT",
    dayNumber: 6,
    subject: "🛵 Delivery Made Easy: Our Dedicated Riders Handle Shipping",
    preheader: "We pick up from your doorstep and deliver to the buyer",
    headline: "Forget Shipping Logistics—We Deliver For You",
    body: "One of the hardest parts of running an online store is managing delivery. With MEEEM, our verified fleet of delivery riders handles order pickup directly from your shop and delivers safely to your customer's doorstep.",
    bulletPoints: [
      "Live GPS tracking for both seller and customer",
      "Zero delivery vehicle or courier contract needed",
      "Safe door-to-door handling and proof of delivery",
    ],
    ctaText: "Stock Products for Delivery →",
    ctaUrl: "/product-seller/products",
    isActive: true,
  },
  {
    sellerType: "PRODUCT",
    dayNumber: 7,
    subject: "🏆 Week 1 Challenge: Get Your First Order on MEEEM!",
    preheader: "You are fully equipped—let's hit your first sales milestone",
    headline: "Celebrate Your First Week as a MEEEM Merchant",
    body: "Congratulations on completing your first 7 days! Stores with 5 or more active products are 80% more likely to generate daily sales. Let's make this week your breakout milestone. Our merchant success team is on standby to help you succeed.",
    bulletPoints: [
      "Aim for at least 5 to 10 active products in your store",
      "Share your store link on WhatsApp, Facebook, and Instagram",
      "24/7 dedicated merchant partner support team",
    ],
    ctaText: "Grow Your Store Today →",
    ctaUrl: "/product-seller/dashboard",
    isActive: true,
  },

  // ==========================================
  // 🛠️ 2. SERVICE SELLER (Days 1 to 7)
  // ==========================================
  {
    sellerType: "SERVICE",
    dayNumber: 1,
    subject: "🛠️ Welcome to MEEEM Services! Create Your Professional Profile",
    preheader: "Turn your skills and expertise into recurring client bookings",
    headline: "Welcome to MEEEM Service Network!",
    body: "Whether you are a mechanic, electrician, beauty specialist, consultant, or technician, MEEEM connects you directly with clients looking for trusted professionals in your area. Let's get your profile set up.",
    bulletPoints: [
      "Showcase your qualifications, experience, and service area",
      "Direct client inquiry and automated booking system",
      "Build verified customer reviews and professional reputation",
    ],
    ctaText: "Set Up Service Profile →",
    ctaUrl: "/service-seller/dashboard",
    isActive: true,
  },
  {
    sellerType: "SERVICE",
    dayNumber: 2,
    subject: "📋 List Your Services: Set Rates & Availability",
    preheader: "Clients in your area are looking for your skills",
    headline: "Add Your Service Offerings & Pricing",
    body: "Clients love clear pricing! Add your key services with fixed or hourly rates and a concise description of what is included. This removes ambiguity and gets clients to book immediately.",
    bulletPoints: [
      "Define fixed or hourly service packages",
      "Specify service coverage radius and availability hours",
      "Instant notification when a client books an appointment",
    ],
    ctaText: "Add Service Offerings →",
    ctaUrl: "/service-seller/services/create",
    isActive: true,
  },
  {
    sellerType: "SERVICE",
    dayNumber: 3,
    subject: "📍 Local Client Reach: Get Booked Nearby Without Ad Costs",
    preheader: "Our location-based matching brings nearby clients to you",
    headline: "Connect with High-Intent Local Clients",
    body: "Customers searching for trusted professionals in your district can find your profile immediately. No need to spend money on expensive flyers or social media ads—MEEEM brings the clients to you.",
    bulletPoints: [
      "Location-based discovery matches you with nearby requests",
      "Free listing and profile verification",
      "Direct in-app messaging and customer booking notifications",
    ],
    ctaText: "Review Your Service Area →",
    ctaUrl: "/service-seller/services",
    isActive: true,
  },
  {
    sellerType: "SERVICE",
    dayNumber: 4,
    subject: "⭐ Stand Out: Tips for Winning 5-Star Reviews & Rehires",
    preheader: "Professional profiles get booked 4x more frequently",
    headline: "Build a 5-Star Reputation on MEEEM",
    body: "A strong profile with past work samples and punctual service creates loyal repeat clients. Add photos of your completed projects and highlight your experience to win high-paying jobs.",
    bulletPoints: [
      "Upload photos of previous work and completed jobs",
      "Arrive on time and communicate clearly via chat/call",
      "Earn verified client reviews to rank at the top",
    ],
    ctaText: "Update Work Portfolio →",
    ctaUrl: "/service-seller/services",
    isActive: true,
  },
  {
    sellerType: "SERVICE",
    dayNumber: 5,
    subject: "💰 Guaranteed Payouts: Get Paid Upon Job Completion",
    preheader: "No chasing unpaid invoices—MEEEM secures your funds",
    headline: "Secure, Guaranteed Payments for Every Job",
    body: "Say goodbye to delayed payments or unpaid invoices! On MEEEM, payments are held securely upon booking and released directly to your wallet upon successful job completion.",
    bulletPoints: [
      "Escrow-protected payments eliminate payment disputes",
      "Withdraw instantly to Mobile Money or bank account",
      "Complete digital transaction records for your accounting",
    ],
    ctaText: "Check Payout Settings →",
    ctaUrl: "/service-seller/settings",
    isActive: true,
  },
  {
    sellerType: "SERVICE",
    dayNumber: 6,
    subject: "📅 Smart Schedule: Control Your Working Hours & Days",
    preheader: "Accept jobs only when you are free—you are your own boss",
    headline: "Complete Flexibility Over Your Time",
    body: "You are in full control of your schedule. Block out busy days, set working hours, or pause new bookings whenever you take time off. MEEEM adapts to your lifestyle, not the other way around.",
    bulletPoints: [
      "Set weekly working hours and holiday blackout dates",
      "Accept, reschedule, or decline booking requests easily",
      "Real-time SMS and email alerts for every new booking",
    ],
    ctaText: "Manage Your Availability →",
    ctaUrl: "/service-seller/dashboard",
    isActive: true,
  },
  {
    sellerType: "SERVICE",
    dayNumber: 7,
    subject: "🎯 7-Day Challenge: Win Your First Booking This Week!",
    preheader: "Take action today and unlock consistent client demand",
    headline: "Your First Booking Is Just Around the Corner",
    body: "You have completed your first week on MEEEM! Service providers who offer at least 3 distinct service packages see a 70% increase in weekly bookings. Review your profile, fine-tune your rates, and get ready for clients!",
    bulletPoints: [
      "List at least 3 distinct services or pricing tiers",
      "Share your MEEEM service profile link with existing clients",
      "Contact our dedicated vendor support team for growth guidance",
    ],
    ctaText: "Accelerate Your Business →",
    ctaUrl: "/service-seller/dashboard",
    isActive: true,
  },

  // ==========================================
  // 🏨 3. HOTEL SELLER (Days 1 to 7)
  // ==========================================
  {
    sellerType: "HOTEL",
    dayNumber: 1,
    subject: "🏨 Welcome to MEEEM Stays! Set Up Your Hotel Profile",
    preheader: "Welcome travelers, tourists, and business guests to your property",
    headline: "Welcome to MEEEM Hospitality Network!",
    body: "Travelers, tourists, and business visitors across the country use MEEEM Stays to discover and book accommodations. Setting up your property profile is the first step toward boosting your occupancy rates year-round.",
    bulletPoints: [
      "Showcase your hotel name, star rating, address, and overview",
      "Highlight prime location, nearby landmarks, and transportation",
      "Full control over room pricing, check-in policies, and amenities",
    ],
    ctaText: "Configure Property Profile →",
    ctaUrl: "/hotel-seller/hotels",
    isActive: true,
  },
  {
    sellerType: "HOTEL",
    dayNumber: 2,
    subject: "🛏️ List Your Rooms: Add Room Types, Rates & Availability",
    preheader: "Guests book fastest when room options and rates are clear",
    headline: "Add Your Room Inventory to MEEEM",
    body: "Empty rooms are lost revenue! List your standard, deluxe, executive, and suite options with room capacity, bed types, and nightly pricing so travelers can book instantly.",
    bulletPoints: [
      "Add room categories with flexible rates and capacities",
      "List in-room amenities (Wi-Fi, AC, TV, Breakfast included)",
      "Automatic inventory management to prevent double-booking",
    ],
    ctaText: "Add Room Inventory →",
    ctaUrl: "/hotel-seller/hotels",
    isActive: true,
  },
  {
    sellerType: "HOTEL",
    dayNumber: 3,
    subject: "🛎️ Special Offers: Attract Travelers with Promo Rates",
    preheader: "Introductory rates get your property featured on search",
    headline: "Boost Bookings with Attractive Opening Rates",
    body: "New hotels on MEEEM get priority exposure in search results! Offering competitive opening rates or weekend discounts encourages guests to book their first stay and leave glowing reviews.",
    bulletPoints: [
      "Set seasonal or weekend discount pricing",
      "Highlighted visibility in MEEEM Stays search & mobile app",
      "Instant booking confirmation sent directly to guest email & SMS",
    ],
    ctaText: "Set Competitive Rates →",
    ctaUrl: "/hotel-seller/hotels",
    isActive: true,
  },
  {
    sellerType: "HOTEL",
    dayNumber: 4,
    subject: "📸 Photography Guide: Photos That Double Hotel Bookings",
    preheader: "High-quality photos are the #1 decision factor for guests",
    headline: "Showcase Your Property in the Best Light",
    body: "Over 85% of guests choose a hotel based on the quality of its room and exterior photos. Clear, bright photos showing clean linens, spacious bathrooms, and common areas instill immediate confidence.",
    bulletPoints: [
      "Take photos during daylight with all room lights turned on",
      "Include photos of the bedroom, bathroom, pool, restaurant, and lobby",
      "Ensure rooms look tidy, neat, and welcoming",
    ],
    ctaText: "Upload High-Res Photos →",
    ctaUrl: "/hotel-seller/hotels",
    isActive: true,
  },
  {
    sellerType: "HOTEL",
    dayNumber: 5,
    subject: "💳 Guaranteed Guest Payments & Seamless Settlements",
    preheader: "No payment disputes—secure online guest reservations",
    headline: "Hassle-Free Hospitality Financial Settlements",
    body: "Managing hotel cashflow has never been easier. When guests book online, payments are captured securely. Funds are settled directly to your designated bank account or mobile wallet without delay.",
    bulletPoints: [
      "Eliminate no-show losses with secure upfront payments",
      "Transparent commission accounting and detailed reservation logs",
      "Fast bank transfer settlements and Mobile Money options",
    ],
    ctaText: "Review Banking Setup →",
    ctaUrl: "/hotel-seller/settings",
    isActive: true,
  },
  {
    sellerType: "HOTEL",
    dayNumber: 6,
    subject: "🌍 Reach Regional & International Tourists on MEEEM",
    preheader: "Connect with business travelers, diaspora visitors, and vacationers",
    headline: "Expand Beyond Walk-In Guests",
    body: "Relying solely on walk-in guests leaves rooms vacant. MEEEM Stays gives you nationwide and international digital visibility, putting your hotel in front of diaspora visitors, tourists, and corporate executives.",
    bulletPoints: [
      "Appear on MEEEM mobile apps used by thousands of travelers",
      "Featured in regional travel promotions and holiday campaigns",
      "Front-desk friendly reservation dashboard for your staff",
    ],
    ctaText: "Optimize Your Listing →",
    ctaUrl: "/hotel-seller/hotels",
    isActive: true,
  },
  {
    sellerType: "HOTEL",
    dayNumber: 7,
    subject: "🏆 Week 1 Challenge: Maximize Your Hotel Occupancy!",
    preheader: "Achieve 100% profile completeness and secure guest bookings",
    headline: "Let's Fill Your Rooms This Month",
    body: "Congratulations on completing week 1 on MEEEM! Properties with full photo galleries and at least 3 active room types see high occupancy rates. Ensure your front desk team is ready for guest check-ins.",
    bulletPoints: [
      "Verify all room types, amenities, and policies are up to date",
      "Train your front desk staff on the MEEEM vendor dashboard",
      "Our hospitality support team is available 24/7 for assistance",
    ],
    ctaText: "View Hotel Dashboard →",
    ctaUrl: "/hotel-seller/dashboard",
    isActive: true,
  },

  // ==========================================
  // 🍔 4. RESTAURANT SELLER (Days 1 to 7)
  // ==========================================
  {
    sellerType: "RESTAURANT",
    dayNumber: 1,
    subject: "🍔 Welcome to MEEEM Food! Set Up Your Restaurant Storefront",
    preheader: "Bring hot meals directly to hungry foodies in your city",
    headline: "Welcome to MEEEM Food Delivery Network!",
    body: "Local food lovers are always looking for great meals! On MEEEM Food, your restaurant is connected to hungry diners with instant ordering and rapid delivery. Let's set up your restaurant profile and operating hours.",
    bulletPoints: [
      "Showcase your restaurant name, cuisine type, logo, and cover photo",
      "Set opening and closing hours for automated order acceptance",
      "Instant order notifications via web dashboard and sound alerts",
    ],
    ctaText: "Set Up Restaurant Profile →",
    ctaUrl: "/restaurant-seller/dashboard",
    isActive: true,
  },
  {
    sellerType: "RESTAURANT",
    dayNumber: 2,
    subject: "🍕 Upload Your Menu: Add Dishes, Combos & Prices",
    preheader: "Hungry diners want to see your specialty dishes and daily specials",
    headline: "Upload Your Mouthwatering Menu Items",
    body: "A well-structured menu with clear descriptions and enticing photos is the secret to high order volume. Group your items into categories like Appetizers, Main Courses, Desserts, and Beverages.",
    bulletPoints: [
      "Organize dishes into clean, logical food categories",
      "Add preparation time, portion sizes, and ingredient notes",
      "Easily mark items as 'In Stock' or 'Sold Out' in real time",
    ],
    ctaText: "Add Menu Dishes →",
    ctaUrl: "/restaurant-seller/foods/create",
    isActive: true,
  },
  {
    sellerType: "RESTAURANT",
    dayNumber: 3,
    subject: "🍟 Attract Foodies: Launch Intro Combos & Meal Deals",
    preheader: "Special combo offers generate 2x more repeat orders",
    headline: "Drive Excitement with Opening Specials",
    body: "Food lovers love great value! Creating meal combos, family packs, or special introductory pricing gives new customers a compelling reason to choose your restaurant for lunch or dinner today.",
    bulletPoints: [
      "Bundle popular dishes with drinks or sides for attractive combos",
      "Featured placement on MEEEM Food homepage & 'New Restaurants'",
      "Encourage positive customer ratings and repeat orders",
    ],
    ctaText: "Create Special Combos →",
    ctaUrl: "/restaurant-seller/foods/create",
    isActive: true,
  },
  {
    sellerType: "RESTAURANT",
    dayNumber: 4,
    subject: "📸 Delicious Photos: How Food Imagery Drives Cravings",
    preheader: "Crisp food photography can increase orders by up to 60%",
    headline: "Make Diners Crave Your Food at First Sight",
    body: "When ordering food online, people eat with their eyes! Bright, close-up photos of freshly prepared meals make stomachs rumble and drive immediate checkout.",
    bulletPoints: [
      "Shoot freshly cooked meals while steaming hot and vibrant",
      "Use simple plates with good contrast against clean table surfaces",
      "Focus on the main hero dish with natural daylight",
    ],
    ctaText: "Update Food Photos →",
    ctaUrl: "/restaurant-seller/foods",
    isActive: true,
  },
  {
    sellerType: "RESTAURANT",
    dayNumber: 5,
    subject: "💵 Fast Daily/Weekly Payouts: Transparent Restaurant Earnings",
    preheader: "Keep your kitchen running with reliable cashflow settlements",
    headline: "Transparent, Timely Earnings Directly to You",
    body: "We know kitchens operate on fast turnover and fresh ingredients. MEEEM provides regular, transparent payouts directly to your Mobile Money wallet or bank account so you can restock without delay.",
    bulletPoints: [
      "Daily or weekly payout settlement cycles",
      "Detailed breakdown per food order, tax, and commission",
      "Direct transfers to Orange Money, Africell, or bank account",
    ],
    ctaText: "Review Payment Settings →",
    ctaUrl: "/restaurant-seller/settings",
    isActive: true,
  },
  {
    sellerType: "RESTAURANT",
    dayNumber: 6,
    subject: "🛵 Hot & Fresh Delivery: Our Riders Handle All Pickups",
    preheader: "Focus on cooking—our dedicated fleet brings meals to doors",
    headline: "Never Worry About Delivery Staff or Motorbikes",
    body: "Hiring delivery drivers is expensive and difficult to manage. MEEEM provides a dedicated fleet of trained riders who arrive at your kitchen the moment food is packed and deliver piping hot to the customer.",
    bulletPoints: [
      "Automated rider dispatch as soon as the order is confirmed",
      "Insulated delivery bags ensure food stays fresh and warm",
      "Live GPS tracking keeps customers informed every minute",
    ],
    ctaText: "Prepare Kitchen for Orders →",
    ctaUrl: "/restaurant-seller/dashboard",
    isActive: true,
  },
  {
    sellerType: "RESTAURANT",
    dayNumber: 7,
    subject: "🏆 Week 1 Challenge: Become a Top-Rated Restaurant!",
    preheader: "You are all set—let's make your kitchen the talk of the town",
    headline: "Ready for a Full Pipeline of Daily Orders",
    body: "Congratulations on finishing your first week on MEEEM Food! Restaurants that maintain at least 10 active menu items and accept orders promptly see rapid growth. Keep your kitchen ready and let's serve happy diners!",
    bulletPoints: [
      "Maintain at least 10 to 15 popular menu items online",
      "Keep preparation times accurate to ensure fast rider pickups",
      "Our dedicated restaurant operations team is here to support you",
    ],
    ctaText: "Check Restaurant Status →",
    ctaUrl: "/restaurant-seller/dashboard",
    isActive: true,
  },
]

export function getDefaultDripTemplate(
  sellerType: "PRODUCT" | "SERVICE" | "HOTEL" | "RESTAURANT",
  dayNumber: number
): DripTemplateItem {
  const normalizedType = (sellerType || "PRODUCT").toUpperCase() as "PRODUCT" | "SERVICE" | "HOTEL" | "RESTAURANT"
  const safeDay = Math.min(Math.max(Number(dayNumber) || 1, 1), 7)

  const found = DEFAULT_DRIP_TEMPLATES.find(
    (t) => t.sellerType === normalizedType && t.dayNumber === safeDay
  )

  return (
    found || {
      sellerType: normalizedType,
      dayNumber: safeDay,
      subject: `Day ${safeDay} on MEEEM: Maximize Your Seller Growth!`,
      preheader: "Boost your sales and client reach on MEEEM",
      headline: `Day ${safeDay} Seller Growth Acceleration`,
      body: "Welcome back to MEEEM! We are committed to helping you scale your business. Log in to your vendor dashboard to manage listings, check customer engagement, and boost your sales.",
      bulletPoints: [
        "Upload and update your catalog listings",
        "Monitor your real-time analytics and customer visits",
        "Reach out to MEEEM partner support anytime",
      ],
      ctaText: "Open Vendor Dashboard →",
      ctaUrl: `/${normalizedType.toLowerCase()}-seller/dashboard`,
      isActive: true,
    }
  )
}
