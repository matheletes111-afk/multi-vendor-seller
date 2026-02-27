-- ============================================================
-- Seed: Meaningful categories and subcategories (PostgreSQL)
-- Run after: psql $DATABASE_URL -f prisma/seed-categories.sql
-- Or paste into your SQL client connected to the same DB.
-- ============================================================
-- Uses ON CONFLICT DO NOTHING so you can re-run safely (unique slug/name).
-- ============================================================

-- Categories (insert first; subcategories reference these)
INSERT INTO categories (id, name, slug, description, "commissionRate", "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'Electronics', 'electronics', 'Electronic devices, gadgets and accessories', 10.0, true, now(), now()),
  (gen_random_uuid()::text, 'Clothing & Fashion', 'clothing-fashion', 'Apparel, footwear and fashion accessories', 12.0, true, now(), now()),
  (gen_random_uuid()::text, 'Home & Garden', 'home-garden', 'Furniture, decor and garden supplies', 10.0, true, now(), now()),
  (gen_random_uuid()::text, 'Health & Beauty', 'health-beauty', 'Cosmetics, personal care and wellness products', 15.0, true, now(), now()),
  (gen_random_uuid()::text, 'Sports & Outdoors', 'sports-outdoors', 'Sporting goods and outdoor equipment', 10.0, true, now(), now()),
  (gen_random_uuid()::text, 'Books & Media', 'books-media', 'Books, e-books and digital media', 8.0, true, now(), now()),
  (gen_random_uuid()::text, 'Consulting', 'consulting', 'Professional consulting and advisory services', 15.0, true, now(), now()),
  (gen_random_uuid()::text, 'Design', 'design', 'Design and creative services', 15.0, true, now(), now())
ON CONFLICT (slug) DO NOTHING;

-- Subcategories: need categoryId from categories. Using slug to link.
-- Subcategory slug must be globally unique, so we use prefixes or unique names.

INSERT INTO subcategories (id, name, slug, description, "isActive", "createdAt", "updatedAt", "categoryId")
SELECT
  gen_random_uuid()::text,
  v.name,
  v.slug,
  v.description,
  true,
  now(),
  now(),
  c.id
FROM (VALUES
  -- Electronics
  ('Smartphones', 'electronics-smartphones', 'Mobile phones and smartphones', 'electronics'),
  ('Laptops & Computers', 'electronics-laptops', 'Laptops, desktops and computer accessories', 'electronics'),
  ('Audio & Headphones', 'electronics-audio', 'Headphones, speakers and audio gear', 'electronics'),
  ('Cameras & Photography', 'electronics-cameras', 'Cameras, lenses and photography equipment', 'electronics'),
  ('Gaming', 'electronics-gaming', 'Gaming consoles, PCs and accessories', 'electronics'),
  -- Clothing & Fashion
  ('Men''s Clothing', 'clothing-mens', 'Men''s apparel and fashion', 'clothing-fashion'),
  ('Women''s Clothing', 'clothing-womens', 'Women''s apparel and fashion', 'clothing-fashion'),
  ('Footwear', 'clothing-footwear', 'Shoes, sneakers and boots', 'clothing-fashion'),
  ('Accessories', 'clothing-accessories', 'Bags, watches and fashion accessories', 'clothing-fashion'),
  ('Kids & Baby', 'clothing-kids', 'Children and baby clothing', 'clothing-fashion'),
  -- Home & Garden
  ('Furniture', 'home-furniture', 'Furniture and home seating', 'home-garden'),
  ('Kitchen & Dining', 'home-kitchen', 'Kitchen appliances and dining', 'home-garden'),
  ('Garden & Outdoor', 'home-garden-outdoor', 'Garden tools and outdoor living', 'home-garden'),
  ('Home Decor', 'home-decor', 'Decor and lighting', 'home-garden'),
  -- Health & Beauty
  ('Skincare', 'health-skincare', 'Skincare and facial care', 'health-beauty'),
  ('Makeup', 'health-makeup', 'Makeup and cosmetics', 'health-beauty'),
  ('Hair Care', 'health-haircare', 'Hair care products', 'health-beauty'),
  ('Personal Care', 'health-personal-care', 'Personal care and wellness', 'health-beauty'),
  -- Sports & Outdoors
  ('Fitness & Gym', 'sports-fitness', 'Fitness and gym equipment', 'sports-outdoors'),
  ('Outdoor Recreation', 'sports-outdoor', 'Camping, hiking and outdoor gear', 'sports-outdoors'),
  ('Cycling', 'sports-cycling', 'Bicycles and cycling accessories', 'sports-outdoors'),
  ('Team Sports', 'sports-team', 'Team sports equipment and apparel', 'sports-outdoors'),
  -- Books & Media
  ('Fiction', 'books-fiction', 'Fiction and literature', 'books-media'),
  ('Non-Fiction', 'books-nonfiction', 'Non-fiction and reference', 'books-media'),
  ('E-books & Digital', 'books-ebooks', 'E-books and digital content', 'books-media'),
  -- Consulting
  ('Business Consulting', 'consulting-business', 'Business strategy and operations', 'consulting'),
  ('IT & Tech Consulting', 'consulting-it', 'IT and technology consulting', 'consulting'),
  ('Legal Consulting', 'consulting-legal', 'Legal advice and consulting', 'consulting'),
  ('Marketing Consulting', 'consulting-marketing', 'Marketing and growth consulting', 'consulting'),
  -- Design
  ('Graphic Design', 'design-graphic', 'Graphic and visual design', 'design'),
  ('Web Design', 'design-web', 'Web and UI/UX design', 'design'),
  ('Interior Design', 'design-interior', 'Interior and space design', 'design'),
  ('Branding', 'design-branding', 'Brand identity and branding', 'design')
) AS v(name, slug, description, cat_slug)
JOIN categories c ON c.slug = v.cat_slug
ON CONFLICT (slug) DO NOTHING;

-- Optional: show what was created
-- SELECT name, slug, "commissionRate" FROM categories ORDER BY name;
-- SELECT s.name, s.slug, c.name AS category FROM subcategories s JOIN categories c ON c.id = s."categoryId" ORDER BY c.name, s.name;
