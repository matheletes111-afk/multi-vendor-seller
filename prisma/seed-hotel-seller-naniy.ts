import { PrismaClient, UserRole, OnboardingStatus } from "@prisma/client"

const prisma = new PrismaClient()

const TARGET_EMAIL = "naniy69646@acanok.com"

const SEED_HOTELS = [
  // ── 1. MUMBAI (4 Hotels) ──
  {
    city: "Mumbai",
    state: "Maharashtra",
    address: "Apollo Bunder, Colaba, Mumbai, Maharashtra 400001",
    name: "Taj Horizon Palace & Spa",
    starRating: 5,
    description: "Iconic 5-star oceanfront luxury palace overlooking the Arabian Sea, featuring fine dining restaurants, world-class spa facilities, and opulent suite rooms.",
    amenities: ["Swimming Pool", "Spa & Wellness", "Free High-Speed WiFi", "24/7 Room Service", "Sea View Restaurant", "Fitness Center", "Valet Parking"],
    checkInPolicy: "Check-in from 2:00 PM. Photo ID and credit card required at check-in.",
    checkOutPolicy: "Check-out by 12:00 PM. Late check-out subject to availability.",
    images: [
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80"
    ],
    logo: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&q=80",
    banner: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80",
    rooms: [
      {
        name: "Deluxe Sea View King Suite",
        description: "Spacious luxury suite with floor-to-ceiling windows offering unobstructed Arabian Sea views, plush king bed, marble bathroom, and walk-in closet.",
        price: 15000,
        capacityAdults: 2,
        capacityChildren: 1,
        totalRooms: 10,
        amenities: ["King Bed", "Ocean View", "Marble Bathroom", "Free WiFi", "Smart TV", "Mini Bar", "Coffee Maker"],
        images: ["https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80"]
      },
      {
        name: "Grand Executive Ocean Suite",
        description: "Opulent executive suite featuring separate living room, dining area, private balcony, and complimentary lounge access.",
        price: 28000,
        capacityAdults: 3,
        capacityChildren: 1,
        totalRooms: 5,
        amenities: ["Separate Living Lounge", "Private Balcony", "Executive Lounge Access", "Jacuzzi", "Free Breakfast"],
        images: ["https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80"]
      },
      {
        name: "Presidential Bay View Villa Suite",
        description: "The pinnacle of grandeur with butler service, private infinity plunge pool, custom interior art, and panoramic harbor views.",
        price: 45000,
        capacityAdults: 4,
        capacityChildren: 2,
        totalRooms: 2,
        amenities: ["Private Plunge Pool", "24/7 Butler Service", "Airport Limousine Transfer", "Private Dining Room"],
        images: ["https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80"]
      }
    ]
  },
  {
    city: "Mumbai",
    state: "Maharashtra",
    address: "Marine Drive, Nariman Point, Mumbai, Maharashtra 400021",
    name: "The Marine Bay Boutique Hotel",
    starRating: 4,
    description: "Chic Art-Deco boutique hotel situated right on Marine Drive promenade, featuring a stunning rooftop lounge overlooking the Queen's Necklace.",
    amenities: ["Rooftop Lounge & Bar", "Promenade Views", "Free WiFi", "Airport Shuttle", "Air Conditioning", "Breakfast Included"],
    checkInPolicy: "Check-in at 1:00 PM. Government approved photo ID required.",
    checkOutPolicy: "Check-out at 11:00 AM.",
    images: [
      "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80",
      "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80"
    ],
    logo: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=200&q=80",
    banner: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80",
    rooms: [
      {
        name: "Premium Promenade View Room",
        description: "Elegant room featuring Art-Deco aesthetic with direct views of the Marine Drive sea promenade.",
        price: 8500,
        capacityAdults: 2,
        capacityChildren: 0,
        totalRooms: 12,
        amenities: ["Queen Bed", "Sea View", "Free WiFi", "Coffee Station", "Rain Shower"],
        images: ["https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80"]
      },
      {
        name: "Art-Deco Skyline Suite",
        description: "Luxurious corner suite with dual views of the city skyline and Arabian sea.",
        price: 14000,
        capacityAdults: 2,
        capacityChildren: 1,
        totalRooms: 4,
        amenities: ["King Bed", "Panoramic View", "Sofa Lounge", "Smart TV", "Mini Fridge"],
        images: ["https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80"]
      }
    ]
  },
  {
    city: "Mumbai",
    state: "Maharashtra",
    address: "BKC Road, Bandra East, Mumbai, Maharashtra 400051",
    name: "Business Heights Suites Bandra",
    starRating: 4,
    description: "Modern business hotel in Bandra-Kurla Complex with state-of-the-art meeting facilities, high-speed fiber internet, and executive dining.",
    amenities: ["Business Center", "Meeting Rooms", "High-Speed WiFi", "Fitness Gym", "24/7 Coffee Shop", "Express Check-in"],
    checkInPolicy: "Express check-in available 24/7.",
    checkOutPolicy: "Check-out till 12:00 PM.",
    images: [
      "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80"
    ],
    logo: "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=200&q=80",
    banner: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1200&q=80",
    rooms: [
      {
        name: "Corporate Executive Room",
        description: "Designed for business travelers with an ergonomic workstation, high-speed internet, and plush bedding.",
        price: 7200,
        capacityAdults: 2,
        capacityChildren: 0,
        totalRooms: 20,
        amenities: ["Ergonomic Desk", "High-Speed WiFi", "King Bed", "Tea/Coffee Maker", "Ironing Facilities"],
        images: ["https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80"]
      },
      {
        name: "Business Club Suite",
        description: "Spacious business suite with meeting table, lounge seating, and club privileges.",
        price: 11500,
        capacityAdults: 2,
        capacityChildren: 0,
        totalRooms: 8,
        amenities: ["Meeting Desk", "Club Lounge Access", "Free Breakfast", "Complimentary Cocktails"],
        images: ["https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80"]
      }
    ]
  },
  {
    city: "Mumbai",
    state: "Maharashtra",
    address: "Juhu Tara Road, Juhu Beach, Mumbai, Maharashtra 400049",
    name: "Juhu Beachfront Resort & Spa",
    starRating: 5,
    description: "Tropical beachfront resort right on Juhu Beach with lush palm trees, infinity swimming pool, sunset terrace, and relaxing spa retreats.",
    amenities: ["Direct Beach Access", "Infinity Pool", "Sunset Bar", "Full Service Spa", "Kids Activity Zone", "Free Breakfast"],
    checkInPolicy: "Check-in at 2:00 PM.",
    checkOutPolicy: "Check-out at 11:00 AM.",
    images: [
      "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&q=80",
      "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80"
    ],
    logo: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=200&q=80",
    banner: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1200&q=80",
    rooms: [
      {
        name: "Coastal Horizon Balcony Suite",
        description: "Bright resort suite with private balcony offering direct views of sunset over the Arabian sea.",
        price: 12500,
        capacityAdults: 2,
        capacityChildren: 1,
        totalRooms: 15,
        amenities: ["Private Balcony", "Sea View", "King Bed", "Pool Access", "Free Breakfast"],
        images: ["https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&q=80"]
      },
      {
        name: "Beachfront Luxury Haven Villa",
        description: "Expansive luxury villa steps from the sand with outdoor private jacuzzi and sun loungers.",
        price: 21000,
        capacityAdults: 3,
        capacityChildren: 1,
        totalRooms: 4,
        amenities: ["Private Jacuzzi", "Steps to Beach", "Sun Deck", "Complimentary Spa Voucher"],
        images: ["https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80"]
      }
    ]
  },

  // ── 2. GOA (4 Hotels) ──
  {
    city: "Goa",
    state: "Goa",
    address: "Candolim Beach Road, North Goa, Goa 403515",
    name: "Sun & Sand Oceanfront Villa & Resort",
    starRating: 5,
    description: "Premium beachside resort in Candolim North Goa featuring private beach access, poolside cabanas, water sports desk, and vibrant seafood dining.",
    amenities: ["Private Beach Access", "Swimming Pool", "Water Sports", "Poolside Bar", "Free Breakfast", "Yoga Deck"],
    checkInPolicy: "Check-in from 2:00 PM.",
    checkOutPolicy: "Check-out by 11:00 AM.",
    images: [
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80",
      "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80",
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80"
    ],
    logo: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=200&q=80",
    banner: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1200&q=80",
    rooms: [
      {
        name: "Ocean View Balcony Room",
        description: "Cozy resort room featuring tropical wooden furnishings and a balcony overlooking Candolim beach.",
        price: 9500,
        capacityAdults: 2,
        capacityChildren: 1,
        totalRooms: 14,
        amenities: ["Balcony", "Ocean View", "King Bed", "Pool Access", "Free WiFi"],
        images: ["https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80"]
      },
      {
        name: "Private Pool Beach Villa",
        description: "Standalone luxury Goan villa with private swimming pool, outdoor rain shower, and tropical garden.",
        price: 22000,
        capacityAdults: 4,
        capacityChildren: 2,
        totalRooms: 3,
        amenities: ["Private Pool", "Outdoor Rain Shower", "Garden Patio", "24/7 Butler"],
        images: ["https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80"]
      }
    ]
  },
  {
    city: "Goa",
    state: "Goa",
    address: "Fontainhas Latin Quarter, Panaji, Goa 403001",
    name: "The Portuguese Heritage Inn",
    starRating: 4,
    description: "Charming 19th-century Portuguese colonial mansion converted into a luxury heritage hotel in the colorful Fontainhas quarter of Panaji.",
    amenities: ["Heritage Garden Courtyard", "Free WiFi", "Art Gallery Cafe", "Bicycle Rental", "Library Lounge"],
    checkInPolicy: "Check-in at 1:00 PM.",
    checkOutPolicy: "Check-out at 11:00 AM.",
    images: [
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
      "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80"
    ],
    logo: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&q=80",
    banner: "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80",
    rooms: [
      {
        name: "Colonial Heritage Deluxe Room",
        description: "Restored room with antique wooden furniture, high ceilings, four-poster bed, and traditional Portuguese tiles.",
        price: 6500,
        capacityAdults: 2,
        capacityChildren: 0,
        totalRooms: 8,
        amenities: ["Four-Poster Bed", "Antique Decor", "Heritage View", "Free WiFi", "Air Conditioning"],
        images: ["https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80"]
      },
      {
        name: "Portuguese Royal Loft Suite",
        description: "Spacious duplex suite with mezzanine lounge, balcony facing cobblestone streets, and clawfoot bathtub.",
        price: 10500,
        capacityAdults: 2,
        capacityChildren: 1,
        totalRooms: 3,
        amenities: ["Mezzanine Lounge", "Clawfoot Tub", "Street View Balcony", "Free Breakfast"],
        images: ["https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80"]
      }
    ]
  },
  {
    city: "Goa",
    state: "Goa",
    address: "Calangute-Baga Main Road, Calangute, Goa 403516",
    name: "Calangute Palms Beach Resort",
    starRating: 4,
    description: "Vibrant family resort nestled between Calangute and Baga beaches, featuring a sprawling lagoon pool, live music nights, and seafood dining.",
    amenities: ["Lagoon Pool", "Seafood Grill & Bar", "Live Entertainment", "Free WiFi", "Airport Transfer Desk"],
    checkInPolicy: "Check-in at 2:00 PM.",
    checkOutPolicy: "Check-out at 11:00 AM.",
    images: [
      "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80",
      "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&q=80"
    ],
    logo: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=200&q=80",
    banner: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=1200&q=80",
    rooms: [
      {
        name: "Palm View Premium Cottage",
        description: "Independent resort cottage surrounded by coconut trees with patio seating and pool access.",
        price: 7800,
        capacityAdults: 2,
        capacityChildren: 1,
        totalRooms: 16,
        amenities: ["Private Patio", "Pool View", "Queen Bed", "Free WiFi"],
        images: ["https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80"]
      },
      {
        name: "Family Poolside Suite",
        description: "Two-bedroom family suite with direct access to the main lagoon pool deck.",
        price: 13500,
        capacityAdults: 4,
        capacityChildren: 2,
        totalRooms: 6,
        amenities: ["Direct Pool Access", "2 Bedrooms", "Sofa Lounge", "Mini Fridge"],
        images: ["https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&q=80"]
      }
    ]
  },
  {
    city: "Goa",
    state: "Goa",
    address: "South Palolem Beach Trail, Canacona, South Goa 403702",
    name: "Palolem Eco Haven & Spa",
    starRating: 5,
    description: "Tranquil eco-friendly luxury sanctuary in South Goa, set amidst pristine nature with Ayurvedic spa therapies, organic dining, and sunset sea views.",
    amenities: ["Organic Wellness Spa", "Private Beach Cabanas", "Ayurvedic Massages", "Sunset Deck", "Yoga Retreat Center"],
    checkInPolicy: "Check-in at 2:00 PM.",
    checkOutPolicy: "Check-out at 12:00 PM.",
    images: [
      "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80"
    ],
    logo: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=200&q=80",
    banner: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1200&q=80",
    rooms: [
      {
        name: "Sea Breeze Eco Cottage",
        description: "Sustainable wooden cottage designed for natural ventilation with open-air bathroom and garden views.",
        price: 8900,
        capacityAdults: 2,
        capacityChildren: 0,
        totalRooms: 10,
        amenities: ["Open-Air Bath", "King Bed", "Garden Hammock", "Organic Toiletries"],
        images: ["https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80"]
      },
      {
        name: "Luxury Wellness Spa Villa",
        description: "Wellness villa equipped with private massage bed, outdoor soak tub, and daily yoga consultation included.",
        price: 18500,
        capacityAdults: 3,
        capacityChildren: 1,
        totalRooms: 3,
        amenities: ["Private Massage Bed", "Outdoor Soak Tub", "Daily Yoga", "Organic Meal Plan"],
        images: ["https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80"]
      }
    ]
  },

  // ── 3. DELHI (4 Hotels) ──
  {
    city: "Delhi",
    state: "Delhi",
    address: "Janpath, Connaught Place, New Delhi, Delhi 110001",
    name: "The Royal Imperial Grand Delhi",
    starRating: 5,
    description: "Prestigious 5-star landmark palace hotel in central Connaught Place New Delhi, offering world-class luxury, award-winning restaurants, and refined imperial hospitality.",
    amenities: ["Fine Dining Restaurants", "Olympic Swimming Pool", "Luxury Spa", "High-Speed WiFi", "Valet Parking", "Concierge Service"],
    checkInPolicy: "Check-in at 2:00 PM. Valid Passport or Govt ID required.",
    checkOutPolicy: "Check-out at 12:00 PM.",
    images: [
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80"
    ],
    logo: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&q=80",
    banner: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80",
    rooms: [
      {
        name: "Executive Heritage Suite",
        description: "Classic luxury suite with handcrafted mahogany furniture, plush Italian linen, and city garden views.",
        price: 16500,
        capacityAdults: 2,
        capacityChildren: 1,
        totalRooms: 15,
        amenities: ["King Bed", "City View", "Italian Linen", "Marble Bathroom", "24/7 Butler"],
        images: ["https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80"]
      },
      {
        name: "Presidential Diplomatic Suite",
        description: "Unrivaled luxury featuring private dining salon, grand piano, bullet-resistant glass, and dedicated butler team.",
        price: 38000,
        capacityAdults: 4,
        capacityChildren: 2,
        totalRooms: 2,
        amenities: ["Private Dining Salon", "Grand Piano", "Jacuzzi", "Limousine Pickup"],
        images: ["https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80"]
      }
    ]
  },
  {
    city: "Delhi",
    state: "Delhi",
    address: "Hospitality District, Aerocity, New Delhi, Delhi 110037",
    name: "Aerocity Prime Airport Hotel",
    starRating: 4,
    description: "Sleek contemporary airport hotel located in Delhi Aerocity, 5 minutes from IGI Airport, offering soundproof rooms, express check-in, and 24/7 dining.",
    amenities: ["24/7 Airport Shuttle", "Soundproof Rooms", "Fitness Center", "Express Breakfast", "Business Lounge", "Free High-Speed WiFi"],
    checkInPolicy: "24-Hour flexible check-in available.",
    checkOutPolicy: "Standard check-out 12:00 PM.",
    images: [
      "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80"
    ],
    logo: "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=200&q=80",
    banner: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1200&q=80",
    rooms: [
      {
        name: "Transit Deluxe Queen",
        description: "Quiet soundproof room designed for restful sleep between flights.",
        price: 6800,
        capacityAdults: 2,
        capacityChildren: 0,
        totalRooms: 25,
        amenities: ["Soundproof Glazing", "Queen Bed", "High-Speed WiFi", "Express Coffee"],
        images: ["https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80"]
      },
      {
        name: "Aerocity Executive Club Suite",
        description: "Spacious business suite with lounge access, workstation, and airport tarmac view.",
        price: 11000,
        capacityAdults: 2,
        capacityChildren: 0,
        totalRooms: 10,
        amenities: ["Tarmac View", "Club Lounge Access", "Free Airport Transfer", "Workstation"],
        images: ["https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80"]
      }
    ]
  },
  {
    city: "Delhi",
    state: "Delhi",
    address: "Golf Links, Lodhi Road, New Delhi, Delhi 110003",
    name: "Lutyens Boutique Residency",
    starRating: 4,
    description: "Exclusive boutique hotel set in prestigious Lutyens Delhi near Lodhi Gardens, surrounded by green lawns and peaceful ambassadorial avenues.",
    amenities: ["Garden Terrace", "Gourmet Breakfast", "Free High-Speed WiFi", "Personal Concierge", "Library"],
    checkInPolicy: "Check-in at 2:00 PM.",
    checkOutPolicy: "Check-out at 12:00 PM.",
    images: [
      "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80",
      "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80"
    ],
    logo: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=200&q=80",
    banner: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80",
    rooms: [
      {
        name: "Garden View Luxury Room",
        description: "Elegantly appointed room opening onto lush private garden manicured lawns.",
        price: 9200,
        capacityAdults: 2,
        capacityChildren: 0,
        totalRooms: 10,
        amenities: ["Garden Terrace Access", "King Bed", "Artisan Coffee", "Free WiFi"],
        images: ["https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80"]
      },
      {
        name: "Lutyens Master Suite",
        description: "Opulent master suite with high ceilings, private balcony, and personal concierge service.",
        price: 15500,
        capacityAdults: 3,
        capacityChildren: 0,
        totalRooms: 4,
        amenities: ["Private Balcony", "Personal Concierge", "Free Gourmet Breakfast", "Soaking Tub"],
        images: ["https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80"]
      }
    ]
  },
  {
    city: "Delhi",
    state: "Delhi",
    address: "Chandni Chowk Road, Old Delhi, Delhi 110006",
    name: "Red Fort View Heritage Hotel",
    starRating: 3,
    description: "Authentic cultural heritage stay in historic Old Delhi featuring a rooftop restaurant with panoramic views of Red Fort and Jama Masjid.",
    amenities: ["Rooftop Fort View Restaurant", "Heritage Tour Desk", "Free WiFi", "Traditional Indian Meals"],
    checkInPolicy: "Check-in at 12:00 PM.",
    checkOutPolicy: "Check-out at 11:00 AM.",
    images: [
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80",
      "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&q=80"
    ],
    logo: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=200&q=80",
    banner: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=1200&q=80",
    rooms: [
      {
        name: "Heritage Standard Room",
        description: "Clean comfortable room decorated with traditional Indian textiles and brass lamps.",
        price: 4200,
        capacityAdults: 2,
        capacityChildren: 0,
        totalRooms: 15,
        amenities: ["Double Bed", "Air Conditioning", "Free WiFi", "Traditional Decor"],
        images: ["https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80"]
      },
      {
        name: "Fort View Deluxe Family Suite",
        description: "Rooftop suite offering breathtaking views of Mughal monuments across Old Delhi skyline.",
        price: 7500,
        capacityAdults: 2,
        capacityChildren: 1,
        totalRooms: 5,
        amenities: ["Fort View Windows", "King Bed", "Sofa Bed", "Rooftop Breakfast"],
        images: ["https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&q=80"]
      }
    ]
  },

  // ── 4. JAIPUR (4 Hotels) ──
  {
    city: "Jaipur",
    state: "Rajasthan",
    address: "Palace Road, Near Amber Fort, Jaipur, Rajasthan 302028",
    name: "The Royal Palace Maharajah Resort",
    starRating: 5,
    description: "Grand royal palace resort in the Pink City featuring traditional Rajasthani architecture, peacocks in royal gardens, folk dance shows, and opulent royal suites.",
    amenities: ["Royal Swimming Pool", "Cultural Folk Shows", "Ayurvedic Spa", "Horse Riding", "Royal Fine Dining", "Helipad"],
    checkInPolicy: "Check-in at 2:00 PM with traditional Rajasthani welcome.",
    checkOutPolicy: "Check-out at 12:00 PM.",
    images: [
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80",
      "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80"
    ],
    logo: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&q=80",
    banner: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80",
    rooms: [
      {
        name: "Rajputana Heritage Suite",
        description: "Opulent palace suite with hand-painted frescoes, royal arches, velvet seating, and garden terrace.",
        price: 18000,
        capacityAdults: 2,
        capacityChildren: 1,
        totalRooms: 12,
        amenities: ["King Size Four-Poster Bed", "Frescoes", "Garden Terrace", "Royal Tea Service"],
        images: ["https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80"]
      },
      {
        name: "Royal Maharajah Presidential Villa",
        description: "Private standalone royal pavilion with private courtyard, marble plunge pool, and royal butler service.",
        price: 42000,
        capacityAdults: 4,
        capacityChildren: 2,
        totalRooms: 2,
        amenities: ["Private Courtyard", "Marble Plunge Pool", "24/7 Royal Butler", "Private Cultural Performance"],
        images: ["https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80"]
      }
    ]
  },
  {
    city: "Jaipur",
    state: "Rajasthan",
    address: "Hawa Mahal Enclave, Old Pink City, Jaipur, Rajasthan 302002",
    name: "Pink City Boutique Haveli",
    starRating: 4,
    description: "Centuries-old restored Haveli located inside Old Pink City, featuring ornate Jharokhas, inner courtyard dining, and rooftop views of Hawa Mahal.",
    amenities: ["Courtyard Dining", "Rooftop Palace View", "Free WiFi", "Traditional Welcome Drink", "Henna & Pottery Demo"],
    checkInPolicy: "Check-in at 1:00 PM.",
    checkOutPolicy: "Check-out at 11:00 AM.",
    images: [
      "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80",
      "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80"
    ],
    logo: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=200&q=80",
    banner: "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80",
    rooms: [
      {
        name: "Haveli Courtyard Deluxe Room",
        description: "Intimate room surrounding the central marble courtyard with traditional mirror work and carved wood doors.",
        price: 7200,
        capacityAdults: 2,
        capacityChildren: 0,
        totalRooms: 10,
        amenities: ["Courtyard View", "Mirrorwork Decor", "Queen Bed", "Free WiFi"],
        images: ["https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80"]
      },
      {
        name: "Peacock Carved Royal Suite",
        description: "Feature suite adorned with peacock stone carvings, stained glass windows, and Jharokha seating.",
        price: 12800,
        capacityAdults: 3,
        capacityChildren: 0,
        totalRooms: 4,
        amenities: ["Jharokha Window Seat", "Stained Glass Art", "King Bed", "Complimentary Rajasthani Thali"],
        images: ["https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80"]
      }
    ]
  },
  {
    city: "Jaipur",
    state: "Rajasthan",
    address: "Amer Hillside Road, Jaipur, Rajasthan 302028",
    name: "Amer Fort View Luxury Retreat",
    starRating: 5,
    description: "Scenic hill resort set on the Aravalli hills overlooking Amber Fort, offering infinity hilltop swimming pool, sunset terrace, and tranquil luxury.",
    amenities: ["Infinity Hilltop Pool", "Fort View Restaurant", "Sunset Terrace Bar", "Spa & Wellness", "Trekking Trails"],
    checkInPolicy: "Check-in at 2:00 PM.",
    checkOutPolicy: "Check-out at 12:00 PM.",
    images: [
      "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&q=80",
      "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80"
    ],
    logo: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=200&q=80",
    banner: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1200&q=80",
    rooms: [
      {
        name: "Scenic Hilltop Deluxe Room",
        description: "Modern hill resort room featuring private sun deck with panoramic Aravalli valley views.",
        price: 11000,
        capacityAdults: 2,
        capacityChildren: 1,
        totalRooms: 12,
        amenities: ["Valley View Sun Deck", "King Bed", "Pool Access", "Free WiFi"],
        images: ["https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&q=80"]
      },
      {
        name: "Amer Royal Fort View Villa",
        description: "Luxury villa with floor-to-ceiling glass walls overlooking illuminated Amber Fort at night.",
        price: 24000,
        capacityAdults: 4,
        capacityChildren: 0,
        totalRooms: 3,
        amenities: ["Fort View Glass Wall", "Private Jacuzzi", "Outdoor Lounge", "Free Breakfast"],
        images: ["https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80"]
      }
    ]
  },
  {
    city: "Jaipur",
    state: "Rajasthan",
    address: "MI Road, Near Raj Mandir Cinema, Jaipur, Rajasthan 302001",
    name: "Jaipur Central Business Hotel",
    starRating: 3,
    description: "Convenient business hotel in Jaipur city center on MI Road, close to shopping bazaars, cinema halls, and major corporate offices.",
    amenities: ["City Center Location", "Free High-Speed WiFi", "Multi-Cuisine Restaurant", "Conference Room", "Travel Desk"],
    checkInPolicy: "Check-in at 12:00 PM.",
    checkOutPolicy: "Check-out at 11:00 AM.",
    images: [
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80"
    ],
    logo: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=200&q=80",
    banner: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80",
    rooms: [
      {
        name: "Superior Business King",
        description: "Efficient city center room with comfortable bedding and work desk.",
        price: 4800,
        capacityAdults: 2,
        capacityChildren: 0,
        totalRooms: 20,
        amenities: ["King Bed", "Work Desk", "Free WiFi", "Air Conditioning"],
        images: ["https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80"]
      },
      {
        name: "Executive Family Suite",
        description: "Connecting family room with extra sofa bed and city view.",
        price: 8200,
        capacityAdults: 3,
        capacityChildren: 1,
        totalRooms: 6,
        amenities: ["Sofa Bed", "City View", "Free WiFi", "Breakfast Included"],
        images: ["https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80"]
      }
    ]
  },

  // ── 5. BENGALURU (4 Hotels) ──
  {
    city: "Bengaluru",
    state: "Karnataka",
    address: "Sankey Road, Sadashivanagar, Bengaluru, Karnataka 560080",
    name: "The Garden City Tech Resort & Spa",
    starRating: 5,
    description: "5-star luxury urban resort spread across 20 acres of lush botanical gardens in Bengaluru, combining nature with cutting-edge tech amenities.",
    amenities: ["Lush Botanical Gardens", "Olympic Pool", "Full Service Spa", "Multi-Cuisine Dining", "Helipad", "High-Speed WiFi"],
    checkInPolicy: "Check-in at 2:00 PM.",
    checkOutPolicy: "Check-out at 12:00 PM.",
    images: [
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80"
    ],
    logo: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&q=80",
    banner: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80",
    rooms: [
      {
        name: "Garden View Luxury King Suite",
        description: "Peaceful luxury suite overlooking ancient Banyan trees and flower gardens.",
        price: 14500,
        capacityAdults: 2,
        capacityChildren: 1,
        totalRooms: 15,
        amenities: ["Garden View Balcony", "Smart Room Automation", "King Bed", "Spa Discount"],
        images: ["https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80"]
      },
      {
        name: "Royal Botanical Penthouse",
        description: "Top floor penthouse with wrap-around garden terrace, private outdoor hot tub, and butler service.",
        price: 32000,
        capacityAdults: 4,
        capacityChildren: 2,
        totalRooms: 2,
        amenities: ["Wrap-Around Terrace", "Hot Tub", "Butler Service", "Helipad Transfer"],
        images: ["https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80"]
      }
    ]
  },
  {
    city: "Bengaluru",
    state: "Karnataka",
    address: "100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038",
    name: "Indiranagar Boutique Living",
    starRating: 4,
    description: "Trendy lifestyle boutique hotel in Bengaluru's vibrant Indiranagar, featuring rooftop craft brewery, co-working pods, and high-speed fiber connectivity.",
    amenities: ["Rooftop Craft Bar", "Co-working Space", "High-Speed Fiber WiFi", "Artisan Cafe", "Fitness Studio"],
    checkInPolicy: "Check-in at 2:00 PM.",
    checkOutPolicy: "Check-out at 12:00 PM.",
    images: [
      "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80",
      "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80"
    ],
    logo: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=200&q=80",
    banner: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80",
    rooms: [
      {
        name: "Urban Chic Studio",
        description: "Modern industrial studio room equipped with standing desk, ergonomic chair, and high-speed fiber WiFi.",
        price: 7500,
        capacityAdults: 2,
        capacityChildren: 0,
        totalRooms: 14,
        amenities: ["Standing Desk", "Ergonomic Chair", "Fiber WiFi", "Espresso Machine"],
        images: ["https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80"]
      },
      {
        name: "Indiranagar Loft Penthouse Suite",
        description: "Trendy multi-level penthouse with private rooftop lounge access and city view.",
        price: 13000,
        capacityAdults: 2,
        capacityChildren: 1,
        totalRooms: 3,
        amenities: ["Multi-Level Loft", "Rooftop Lounge Access", "Smart TV", "Free Breakfast"],
        images: ["https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80"]
      }
    ]
  },
  {
    city: "Bengaluru",
    state: "Karnataka",
    address: "Phase 1, Electronic City, Bengaluru, Karnataka 560100",
    name: "Electronic City IT Business Park Hotel",
    starRating: 4,
    description: "Premier business hotel located in Electronic City IT Hub, tailored for tech executives with 24/7 business center, airport express shuttle, and conference facilities.",
    amenities: ["24/7 Business Center", "Gym & Fitness", "Airport Express Shuttle", "High-Speed WiFi", "Executive Restaurant"],
    checkInPolicy: "Flexible 24/7 check-in.",
    checkOutPolicy: "Check-out till 1:00 PM.",
    images: [
      "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80"
    ],
    logo: "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=200&q=80",
    banner: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1200&q=80",
    rooms: [
      {
        name: "Tech Executive King Room",
        description: "Quiet business room with ergonomic office chair, high-speed dual WiFi, and blackout curtains.",
        price: 6200,
        capacityAdults: 2,
        capacityChildren: 0,
        totalRooms: 30,
        amenities: ["Ergonomic Chair", "Blackout Curtains", "King Bed", "Free WiFi"],
        images: ["https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80"]
      },
      {
        name: "IT Director Club Suite",
        description: "Executive suite with private meeting lounge, club lounge access, and free airport pickup.",
        price: 9800,
        capacityAdults: 2,
        capacityChildren: 0,
        totalRooms: 8,
        amenities: ["Private Meeting Lounge", "Club Access", "Airport Transfer", "Free Breakfast"],
        images: ["https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80"]
      }
    ]
  },
  {
    city: "Bengaluru",
    state: "Karnataka",
    address: "Nandi Hills Road, Devanahalli, Bengaluru, Karnataka 562110",
    name: "Nandi Hills Serene Resort & Spa",
    starRating: 5,
    description: "Picturesque hill retreat located at the base of Nandi Hills near Kempegowda International Airport, featuring mountain views, infinity pool, and outdoor adventure activities.",
    amenities: ["Mountain View Infinity Pool", "Trekking & Camping", "Outdoor Jacuzzi", "Barbecue Grill", "Free Breakfast"],
    checkInPolicy: "Check-in at 2:00 PM.",
    checkOutPolicy: "Check-out at 11:00 AM.",
    images: [
      "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&q=80",
      "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80"
    ],
    logo: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=200&q=80",
    banner: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1200&q=80",
    rooms: [
      {
        name: "Mountain View Sunrise Villa",
        description: "Villa with private deck offering breathtaking sunrise views over Nandi Hills valley.",
        price: 11500,
        capacityAdults: 2,
        capacityChildren: 1,
        totalRooms: 10,
        amenities: ["Sunrise View Deck", "King Bed", "Fireplace", "Pool Access"],
        images: ["https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&q=80"]
      },
      {
        name: "Nandi Cloud Valley Family Suite",
        description: "Luxury hill suite featuring private outdoor jacuzzi and bonfire lounge area.",
        price: 21500,
        capacityAdults: 4,
        capacityChildren: 2,
        totalRooms: 4,
        amenities: ["Outdoor Jacuzzi", "Bonfire Lounge", "2 Bedrooms", "Free Breakfast"],
        images: ["https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80"]
      }
    ]
  }
]

async function main() {
  console.log(`Searching for user with email: ${TARGET_EMAIL}...`)

  let user = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
  })

  if (!user) {
    console.log(`User ${TARGET_EMAIL} not found. Creating user record...`)
    user = await prisma.user.create({
      data: {
        email: TARGET_EMAIL,
        name: "Naniy Hotel Partner",
        role: UserRole.SELLER_HOTEL,
        isEmailVerified: true,
      },
    })
  } else {
    console.log(`User found: ID ${user.id}`)
    // Ensure role is SELLER_HOTEL
    if (user.role !== UserRole.SELLER_HOTEL) {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: UserRole.SELLER_HOTEL },
      })
    }
  }

  let hotelSeller = await prisma.hotelSeller.findUnique({
    where: { userId: user.id },
  })

  if (!hotelSeller) {
    console.log(`Creating HotelSeller for user ${user.id}...`)
    hotelSeller = await prisma.hotelSeller.create({
      data: {
        userId: user.id,
        isApproved: true,
        isSuspended: false,
        onboardingCompleted: true,
        onboardingStep: 4,
        status: OnboardingStatus.APPROVED,
        estimateHotelCount: SEED_HOTELS.length,
        estimateRoomCount: SEED_HOTELS.reduce((acc, h) => acc + h.rooms.length, 0),
        logo: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&q=80",
        banner: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80",
        businessInfo: {
          create: {
            businessName: "Naniy Premium Hotels & Resorts Group",
            businessType: "Company",
            city: "Mumbai",
            state: "Maharashtra",
            managerName: "Naniy Partner Manager",
            street: "Marine Drive Promenade",
          },
        },
      },
    })
  } else {
    console.log(`HotelSeller record found: ID ${hotelSeller.id}`)
    // Ensure approved and active
    await prisma.hotelSeller.update({
      where: { id: hotelSeller.id },
      data: {
        isApproved: true,
        isSuspended: false,
        onboardingCompleted: true,
        status: OnboardingStatus.APPROVED,
      },
    })
  }

  console.log(`Seeding ${SEED_HOTELS.length} hotels across 5 cities for HotelSeller: ${hotelSeller.id}...`)

  let createdCount = 0
  let roomsCount = 0

  for (const h of SEED_HOTELS) {
    // Check if hotel with same name already exists under this seller
    const existing = await prisma.hotel.findFirst({
      where: {
        hotelSellerId: hotelSeller.id,
        name: h.name,
      },
    })

    if (existing) {
      console.log(`Hotel "${h.name}" already exists in ${h.city}. Skipping...`)
      continue
    }

    const createdHotel = await prisma.hotel.create({
      data: {
        hotelSellerId: hotelSeller.id,
        name: h.name,
        description: h.description,
        starRating: h.starRating,
        city: h.city,
        state: h.state,
        address: h.address,
        amenities: h.amenities,
        checkInPolicy: h.checkInPolicy,
        checkOutPolicy: h.checkOutPolicy,
        images: h.images,
        logo: h.logo,
        banner: h.banner,
        isActive: true,
        isDeleted: false,
        rooms: {
          create: h.rooms.map((r) => ({
            name: r.name,
            description: r.description,
            price: r.price,
            capacityAdults: r.capacityAdults,
            capacityChildren: r.capacityChildren,
            totalRooms: r.totalRooms,
            amenities: r.amenities,
            images: r.images,
            isActive: true,
            isDeleted: false,
          })),
        },
      },
      include: {
        rooms: true,
      },
    })

    createdCount++
    roomsCount += createdHotel.rooms.length
    console.log(`[SUCCESS] Created Hotel: "${createdHotel.name}" in ${createdHotel.city} (${createdHotel.rooms.length} rooms)`)
  }

  console.log(`\n🎉 SEED COMPLETE!`)
  console.log(`- Seller Email: ${TARGET_EMAIL}`)
  console.log(`- Total New Hotels Created: ${createdCount}`)
  console.log(`- Total Rooms Created: ${roomsCount}`)
}

main()
  .catch((e) => {
    console.error("Seed script failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
