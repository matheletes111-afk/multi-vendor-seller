-- Seed: Service categories (admin-level) + sample services for seller cmjmsdcei000m13d18s3112g7
-- Run after migrations. Uses image links; mobileIcon left NULL.
-- PostgreSQL (quoted camelCase columns per Prisma).
--
-- Ensure seller id cmjmsdcei000m13d18s3112g7 exists (e.g. a SERVICE seller in the sellers table).
-- Run: psql $DATABASE_URL -f prisma/seed-service-categories-and-services.sql
-- Or from Prisma: npx prisma db execute --file prisma/seed-service-categories-and-services.sql

-- =============================================================================
-- PART 1: Service categories (Plumber, AC Mechanical, Electronic Mechanical, etc.)
-- =============================================================================

INSERT INTO service_categories (
  id,
  name,
  slug,
  description,
  image,
  "mobileIcon",
  "commissionRate",
  "isActive",
  "createdAt",
  "updatedAt"
)
VALUES
  (
    gen_random_uuid()::text,
    'Plumber',
    'plumber',
    'Plumbing repair, installation, and maintenance: pipes, taps, toilets, water heaters, drainage.',
    'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800',
    NULL,
    10.0,
    true,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid()::text,
    'AC Mechanical',
    'ac-mechanical',
    'AC installation, repair, gas refill, duct cleaning, and HVAC maintenance.',
    'https://images.unsplash.com/photo-1631545914468-fdfa0b2c7b4a?w=800',
    NULL,
    10.0,
    true,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid()::text,
    'Electronic Mechanical',
    'electronic-mechanical',
    'TV, fridge, washing machine, microwave and other home appliance repair and servicing.',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
    NULL,
    10.0,
    true,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid()::text,
    'Garage Mechanical',
    'garage-mechanical',
    'Car and bike servicing, brake and clutch repair, engine check, tyre replacement.',
    'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800',
    NULL,
    10.0,
    true,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid()::text,
    'Electrical',
    'electrical',
    'Wiring, switch/socket repair, fuse, MCB, lighting, and electrical safety checks.',
    'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800',
    NULL,
    10.0,
    true,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid()::text,
    'Carpentry & Handyman',
    'carpentry-handyman',
    'Furniture repair, door/window fitting, shelving, and general handyman jobs.',
    'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800',
    NULL,
    10.0,
    true,
    NOW(),
    NOW()
  )
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- PART 2: Services for seller id cmjmsdcei000m13d18s3112g7 (one per category)
-- Run PART 1 first. Ensure seller cmjmsdcei000m13d18s3112g7 exists in sellers table.
-- =============================================================================

INSERT INTO services (id, "sellerId", "serviceCategoryId", name, slug, description, "serviceType", "basePrice", discount, "hasGst", images, "isActive", "isFeatured", duration, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'cmjmsdcei000m13d18s3112g7',
  (SELECT id FROM service_categories WHERE slug = 'plumber' LIMIT 1),
  'Plumbing – pipe & tap repair',
  'plumbing-pipe-tap-repair',
  'Pipe repair, tap fixing, toilet and drainage solutions.',
  'FIXED_PRICE',
  800.00,
  0,
  true,
  '["https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400"]'::jsonb,
  true,
  false,
  60,
  NOW(),
  NOW()
);

INSERT INTO services (id, "sellerId", "serviceCategoryId", name, slug, description, "serviceType", "basePrice", discount, "hasGst", images, "isActive", "isFeatured", duration, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'cmjmsdcei000m13d18s3112g7',
  (SELECT id FROM service_categories WHERE slug = 'ac-mechanical' LIMIT 1),
  'AC service & repair',
  'ac-service-repair',
  'AC repair, gas refill, and general servicing.',
  'FIXED_PRICE',
  1200.00,
  0,
  true,
  '["https://images.unsplash.com/photo-1631545914468-fdfa0b2c7b4a?w=400"]'::jsonb,
  true,
  false,
  90,
  NOW(),
  NOW()
);

INSERT INTO services (id, "sellerId", "serviceCategoryId", name, slug, description, "serviceType", "basePrice", discount, "hasGst", images, "isActive", "isFeatured", duration, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'cmjmsdcei000m13d18s3112g7',
  (SELECT id FROM service_categories WHERE slug = 'electronic-mechanical' LIMIT 1),
  'TV & appliance repair',
  'tv-appliance-repair',
  'TV, fridge, washing machine repair and maintenance.',
  'FIXED_PRICE',
  600.00,
  0,
  true,
  '["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400"]'::jsonb,
  true,
  false,
  45,
  NOW(),
  NOW()
);

INSERT INTO services (id, "sellerId", "serviceCategoryId", name, slug, description, "serviceType", "basePrice", discount, "hasGst", images, "isActive", "isFeatured", duration, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'cmjmsdcei000m13d18s3112g7',
  (SELECT id FROM service_categories WHERE slug = 'garage-mechanical' LIMIT 1),
  'Car & bike servicing',
  'car-bike-servicing',
  'Car and bike servicing, brake and engine check.',
  'FIXED_PRICE',
  1500.00,
  0,
  true,
  '["https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400"]'::jsonb,
  true,
  false,
  120,
  NOW(),
  NOW()
);

INSERT INTO services (id, "sellerId", "serviceCategoryId", name, slug, description, "serviceType", "basePrice", discount, "hasGst", images, "isActive", "isFeatured", duration, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'cmjmsdcei000m13d18s3112g7',
  (SELECT id FROM service_categories WHERE slug = 'electrical' LIMIT 1),
  'Electrical wiring & repair',
  'electrical-wiring-repair',
  'Wiring, switch repair, and electrical safety checks.',
  'FIXED_PRICE',
  500.00,
  0,
  true,
  '["https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=400"]'::jsonb,
  true,
  false,
  60,
  NOW(),
  NOW()
);

INSERT INTO services (id, "sellerId", "serviceCategoryId", name, slug, description, "serviceType", "basePrice", discount, "hasGst", images, "isActive", "isFeatured", duration, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'cmjmsdcei000m13d18s3112g7',
  (SELECT id FROM service_categories WHERE slug = 'carpentry-handyman' LIMIT 1),
  'Carpentry & handyman',
  'carpentry-handyman-service',
  'Furniture repair, door fitting, and handyman jobs.',
  'FIXED_PRICE',
  700.00,
  0,
  true,
  '["https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=400"]'::jsonb,
  true,
  false,
  90,
  NOW(),
  NOW()
);
