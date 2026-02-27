-- =============================================================================
-- SEED: Service ads (YouTube video or image link). Deletes previous service ads,
--       then seeds 3 services + 5 service ads (3 image, 2 video) for seller
--       cmjmscyae000a13d1oxi4detu.
-- Run: PostgreSQL. Run after seed-categories-products.sql (categories must exist).
-- If you already have services, comment out Step 2 and set "serviceId" in Step 3
-- to your real service IDs.
-- =============================================================================

-- Step 1: Delete ad clicks for service ads, then delete service ads only
DELETE FROM ad_clicks
WHERE "adId" IN (SELECT id FROM seller_ads WHERE "serviceId" IS NOT NULL);

DELETE FROM seller_ads WHERE "serviceId" IS NOT NULL;

-- Step 2: Insert a few services so we have something to advertise (skip if you already have services)
-- Uses same seller and category IDs as seed-categories-products.sql
INSERT INTO services (id, "sellerId", "categoryId", name, slug, description, "serviceType", "basePrice", discount, "hasGst", images, "isActive", "isFeatured", duration, "createdAt", "updatedAt")
VALUES
('svc_seed_1', 'cmjmscyae000a13d1oxi4detu', 'cat_grocery', 'Home Delivery', 'home-delivery', 'Quick grocery delivery', 'FIXED_PRICE', 5.99, 0, true, '["https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400"]'::jsonb, true, false, NULL, NOW(), NOW()),
('svc_seed_2', 'cmjmscyae000a13d1oxi4detu', 'cat_electronics', 'Device Setup', 'device-setup', 'Professional device setup', 'APPOINTMENT', 29.99, 0, true, '["https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400"]'::jsonb, true, false, 60, NOW(), NOW()),
('svc_seed_3', 'cmjmscyae000a13d1oxi4detu', 'cat_beauty', 'Skincare Consultation', 'skincare-consultation', 'One-on-one skincare advice', 'APPOINTMENT', 0, 0, true, '["https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400"]'::jsonb, true, false, 30, NOW(), NOW())
ON CONFLICT ("sellerId", slug) DO NOTHING;

-- Step 3: Insert service ads (IMAGE = normal image link, VIDEO = YouTube URL)
-- startAt/endAt: campaign window; totalBudget in currency units; maxCpc = cost per click
INSERT INTO seller_ads (id, "sellerId", "productId", "serviceId", title, description, "creativeType", "creativeUrl", status, "totalBudget", "spentAmount", "maxCpc", "startAt", "endAt", "createdAt", "updatedAt")
VALUES
-- Image creatives
('sad_1', 'cmjmscyae000a13d1oxi4detu', NULL, 'svc_seed_1', 'Grocery Delivery Promo', 'Get your groceries delivered fast', 'IMAGE', 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800', 'ACTIVE', 100.00, 0, 0.50, NOW(), NOW() + INTERVAL '30 days', NOW(), NOW()),
('sad_2', 'cmjmscyae000a13d1oxi4detu', NULL, 'svc_seed_2', 'Device Setup Offer', 'Expert setup for your new devices', 'IMAGE', 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800', 'ACTIVE', 75.00, 0, 0.75, NOW(), NOW() + INTERVAL '14 days', NOW(), NOW()),
('sad_3', 'cmjmscyae000a13d1oxi4detu', NULL, 'svc_seed_3', 'Skincare Consultation', 'Book a free consultation', 'IMAGE', 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800', 'PENDING_APPROVAL', 50.00, 0, 0.40, NOW(), NOW() + INTERVAL '7 days', NOW(), NOW()),
-- Video creatives (YouTube links)
('sad_4', 'cmjmscyae000a13d1oxi4detu', NULL, 'svc_seed_1', 'How We Deliver', 'See our delivery process', 'VIDEO', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'ACTIVE', 120.00, 0, 0.60, NOW(), NOW() + INTERVAL '30 days', NOW(), NOW()),
('sad_5', 'cmjmscyae000a13d1oxi4detu', NULL, 'svc_seed_2', 'Setup Tutorial', 'Quick setup guide', 'VIDEO', 'https://www.youtube.com/watch?v=jNQXAC9IVRw', 'ACTIVE', 80.00, 0, 0.55, NOW(), NOW() + INTERVAL '21 days', NOW(), NOW());

-- Done: previous service ads removed; 3 services + 5 service ads (3 IMAGE, 2 VIDEO) seeded.
-- Replace YouTube URLs (dQw4w9WgXcQ, jNQXAC9IVRw) with your own video IDs if needed.
