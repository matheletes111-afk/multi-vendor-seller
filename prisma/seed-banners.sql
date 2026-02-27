-- =============================================================================
-- SEED: Delete all banners and insert 10 banners with mixed targeting.
--       - 2 for "all" (categoryId/subcategoryId NULL)
--       - 5 for category only
--       - 3 for category + subcategory
--       Uses image links (Unsplash). Home and detail pages load both image
--       links and /uploads/ paths via <img src="..." />.
-- Run: PostgreSQL. Run after seed-categories-products.sql (categories must exist).
-- =============================================================================

DELETE FROM banners;

-- Insert 10 banners (image URLs work as link or upload path on home/detail pages)
INSERT INTO banners (id, "bannerHeading", "bannerDescription", "bannerImage", "isActive", "createdAt", "updatedAt", "categoryId", "subcategoryId") VALUES
-- All categories (2)
('bn_1', 'Shop Everything', 'Discover deals across all categories', 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200', true, NOW(), NOW(), NULL, NULL),
('bn_2', 'Weekend Sale', 'Up to 30% off this weekend only', 'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=1200', true, NOW(), NOW(), NULL, NULL),
-- Category only (5)
('bn_3', 'Fresh Grocery', 'Daily essentials delivered to your door', 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200', true, NOW(), NOW(), 'cat_grocery', NULL),
('bn_4', 'Electronics Deals', 'Phones, laptops & gadgets', 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=1200', true, NOW(), NOW(), 'cat_electronics', NULL),
('bn_5', 'Fashion Sale', 'New arrivals & seasonal styles', 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1200', true, NOW(), NOW(), 'cat_fashion', NULL),
('bn_6', 'Home & Garden', 'Furniture, decor and more', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1200', true, NOW(), NOW(), 'cat_home', NULL),
('bn_7', 'Beauty & Personal Care', 'Skincare, makeup & hygiene', 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1200', true, NOW(), NOW(), 'cat_beauty', NULL),
-- Category + subcategory (3)
('bn_8', 'Dairy & Eggs', 'Fresh dairy and eggs', 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=1200', true, NOW(), NOW(), 'cat_grocery', 'sub_g1'),
('bn_9', 'Laptops & Computers', 'Best deals on laptops', 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=1200', true, NOW(), NOW(), 'cat_electronics', 'sub_e2'),
('bn_10', 'Men''s Clothing', 'Trending menswear', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200', true, NOW(), NOW(), 'cat_fashion', 'sub_f1');

-- Done: 10 banners (2 all, 5 category-only, 3 category+subcategory). All use image links.
