-- =============================================================================
-- SEED: Remove all categories & subcategories, add 10 categories with 4-5
--       subcategories each, and 25 products for seller cmjmscyae000a13d1oxi4detu
--       Includes Grocery category.
-- Run: PostgreSQL (as-is). For MySQL: wrap identifiers in backticks (`id`, `categoryId`, etc.).
-- =============================================================================

-- Step 1: Clear references so we can delete categories/subcategories
-- Banners: unlink category and subcategory
UPDATE banners SET "categoryId" = NULL, "subcategoryId" = NULL;

-- Product-related: unlink or delete so products can be removed
UPDATE order_items SET "productId" = NULL WHERE "productId" IS NOT NULL;
UPDATE cart_items SET "productId" = NULL WHERE "productId" IS NOT NULL;
DELETE FROM reviews WHERE "productId" IS NOT NULL;
UPDATE seller_ads SET "productId" = NULL WHERE "productId" IS NOT NULL;
DELETE FROM product_variants;
DELETE FROM products;

-- Services reference category; must remove or we cannot delete categories
DELETE FROM service_slots;
DELETE FROM service_packages;
UPDATE order_items SET "serviceId" = NULL WHERE "serviceId" IS NOT NULL;
UPDATE cart_items SET "serviceId" = NULL WHERE "serviceId" IS NOT NULL;
DELETE FROM reviews WHERE "serviceId" IS NOT NULL;
UPDATE seller_ads SET "serviceId" = NULL WHERE "serviceId" IS NOT NULL;
DELETE FROM services;

-- Step 2: Delete subcategories then categories
DELETE FROM subcategories;
DELETE FROM categories;

-- Step 3: Insert 10 categories (Grocery + 9 others)
-- Using explicit ids so subcategories and products can reference them
INSERT INTO categories (id, name, slug, description, image, "commissionRate", "isActive", "createdAt", "updatedAt") VALUES
('cat_grocery', 'Grocery', 'grocery', 'Food, beverages & daily essentials', 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400', 10.0, true, NOW(), NOW()),
('cat_electronics', 'Electronics', 'electronics', 'Phones, laptops & gadgets', 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400', 10.0, true, NOW(), NOW()),
('cat_fashion', 'Fashion', 'fashion', 'Clothing, shoes & accessories', 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=400', 10.0, true, NOW(), NOW()),
('cat_home', 'Home & Garden', 'home-garden', 'Furniture, decor & outdoor', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400', 10.0, true, NOW(), NOW()),
('cat_beauty', 'Beauty & Personal Care', 'beauty-personal-care', 'Skincare, makeup & hygiene', 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400', 10.0, true, NOW(), NOW()),
('cat_sports', 'Sports & Outdoors', 'sports-outdoors', 'Fitness, camping & recreation', 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400', 10.0, true, NOW(), NOW()),
('cat_books', 'Books & Stationery', 'books-stationery', 'Books, office supplies & art', 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400', 10.0, true, NOW(), NOW()),
('cat_toys', 'Toys & Kids', 'toys-kids', 'Toys, baby & kids products', 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=400', 10.0, true, NOW(), NOW()),
('cat_health', 'Health & Wellness', 'health-wellness', 'Vitamins, supplements & wellness', 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=400', 10.0, true, NOW(), NOW()),
('cat_automotive', 'Automotive', 'automotive', 'Car parts, tools & accessories', 'https://images.unsplash.com/photo-1494976388531-d1058494cd4f?w=400', 10.0, true, NOW(), NOW());

-- Step 4: Insert 4-5 subcategories per category (slug must be globally unique)
INSERT INTO subcategories (id, name, slug, description, image, "isActive", "createdAt", "updatedAt", "categoryId") VALUES
-- Grocery (5)
('sub_g1', 'Dairy & Eggs', 'grocery-dairy-eggs', NULL, 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400', true, NOW(), NOW(), 'cat_grocery'),
('sub_g2', 'Bakery & Bread', 'grocery-bakery-bread', NULL, 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400', true, NOW(), NOW(), 'cat_grocery'),
('sub_g3', 'Fruits & Vegetables', 'grocery-fruits-vegetables', NULL, 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400', true, NOW(), NOW(), 'cat_grocery'),
('sub_g4', 'Snacks & Beverages', 'grocery-snacks-beverages', NULL, 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400', true, NOW(), NOW(), 'cat_grocery'),
('sub_g5', 'Pantry Staples', 'grocery-pantry-staples', NULL, 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400', true, NOW(), NOW(), 'cat_grocery'),
-- Electronics (4)
('sub_e1', 'Mobile Phones', 'electronics-mobile-phones', NULL, 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400', true, NOW(), NOW(), 'cat_electronics'),
('sub_e2', 'Laptops & Computers', 'electronics-laptops-computers', NULL, 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400', true, NOW(), NOW(), 'cat_electronics'),
('sub_e3', 'Audio & Headphones', 'electronics-audio-headphones', NULL, 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400', true, NOW(), NOW(), 'cat_electronics'),
('sub_e4', 'Accessories', 'electronics-accessories', NULL, 'https://images.unsplash.com/photo-1625723044792-44de16ccb4e9?w=400', true, NOW(), NOW(), 'cat_electronics'),
-- Fashion (4)
('sub_f1', 'Men''s Clothing', 'fashion-mens-clothing', NULL, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400', true, NOW(), NOW(), 'cat_fashion'),
('sub_f2', 'Women''s Clothing', 'fashion-womens-clothing', NULL, 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400', true, NOW(), NOW(), 'cat_fashion'),
('sub_f3', 'Shoes', 'fashion-shoes', NULL, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400', true, NOW(), NOW(), 'cat_fashion'),
('sub_f4', 'Bags & Accessories', 'fashion-bags-accessories', NULL, 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=400', true, NOW(), NOW(), 'cat_fashion'),
-- Home & Garden (4)
('sub_h1', 'Furniture', 'home-furniture', NULL, 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400', true, NOW(), NOW(), 'cat_home'),
('sub_h2', 'Decor', 'home-decor', NULL, 'https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=400', true, NOW(), NOW(), 'cat_home'),
('sub_h3', 'Kitchen', 'home-kitchen', NULL, 'https://images.unsplash.com/photo-1584990347492-659b3e529b43?w=400', true, NOW(), NOW(), 'cat_home'),
('sub_h4', 'Garden', 'home-garden-outdoor', NULL, 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400', true, NOW(), NOW(), 'cat_home'),
-- Beauty (4)
('sub_b1', 'Skincare', 'beauty-skincare', NULL, 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400', true, NOW(), NOW(), 'cat_beauty'),
('sub_b2', 'Makeup', 'beauty-makeup', NULL, 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400', true, NOW(), NOW(), 'cat_beauty'),
('sub_b3', 'Hair Care', 'beauty-hair-care', NULL, 'https://images.unsplash.com/photo-1522338242762-5d67450f1b35?w=400', true, NOW(), NOW(), 'cat_beauty'),
('sub_b4', 'Personal Care', 'beauty-personal-care', NULL, 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400', true, NOW(), NOW(), 'cat_beauty'),
-- Sports (4)
('sub_s1', 'Fitness', 'sports-fitness', NULL, 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=400', true, NOW(), NOW(), 'cat_sports'),
('sub_s2', 'Outdoor', 'sports-outdoor', NULL, 'https://images.unsplash.com/photo-1510312305653-8ed496ef75e4?w=400', true, NOW(), NOW(), 'cat_sports'),
('sub_s3', 'Cycling', 'sports-cycling', NULL, 'https://images.unsplash.com/photo-1541625602330-2277a4c46182?w=400', true, NOW(), NOW(), 'cat_sports'),
('sub_s4', 'Team Sports', 'sports-team-sports', NULL, 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=400', true, NOW(), NOW(), 'cat_sports'),
-- Books (4)
('sub_k1', 'Fiction', 'books-fiction', NULL, 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400', true, NOW(), NOW(), 'cat_books'),
('sub_k2', 'Non-Fiction', 'books-non-fiction', NULL, 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400', true, NOW(), NOW(), 'cat_books'),
('sub_k3', 'Stationery', 'books-stationery', NULL, 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400', true, NOW(), NOW(), 'cat_books'),
('sub_k4', 'Art Supplies', 'books-art-supplies', NULL, 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=400', true, NOW(), NOW(), 'cat_books'),
-- Toys & Kids (4)
('sub_t1', 'Toys', 'toys-toys', NULL, 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=400', true, NOW(), NOW(), 'cat_toys'),
('sub_t2', 'Baby Care', 'toys-baby-care', NULL, 'https://images.unsplash.com/photo-1587668178277-295251f900ce?w=400', true, NOW(), NOW(), 'cat_toys'),
('sub_t3', 'Kids Clothing', 'toys-kids-clothing', NULL, 'https://images.unsplash.com/photo-1503919545889-aef636e10ad4?w=400', true, NOW(), NOW(), 'cat_toys'),
('sub_t4', 'Educational', 'toys-educational', NULL, 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400', true, NOW(), NOW(), 'cat_toys'),
-- Health (4)
('sub_w1', 'Vitamins', 'health-vitamins', NULL, 'https://images.unsplash.com/photo-1550572017-edd951aa1ee8?w=400', true, NOW(), NOW(), 'cat_health'),
('sub_w2', 'Supplements', 'health-supplements', NULL, 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400', true, NOW(), NOW(), 'cat_health'),
('sub_w3', 'Wellness', 'health-wellness', NULL, 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=400', true, NOW(), NOW(), 'cat_health'),
('sub_w4', 'Medical', 'health-medical', NULL, 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400', true, NOW(), NOW(), 'cat_health'),
-- Automotive (4)
('sub_a1', 'Parts', 'automotive-parts', NULL, 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400', true, NOW(), NOW(), 'cat_automotive'),
('sub_a2', 'Tools', 'automotive-tools', NULL, 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400', true, NOW(), NOW(), 'cat_automotive'),
('sub_a3', 'Accessories', 'automotive-accessories', NULL, 'https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=400', true, NOW(), NOW(), 'cat_automotive'),
('sub_a4', 'Care', 'automotive-care', NULL, 'https://images.unsplash.com/photo-1607860108855-64b4c1b1d136?w=400', true, NOW(), NOW(), 'cat_automotive');

-- Step 5: Insert 25 products for seller cmjmscyae000a13d1oxi4detu
-- Spread across Grocery (more) and other categories. Images as JSON array.
-- slug must be unique per seller (sellerId + slug unique).
INSERT INTO products (id, "sellerId", "categoryId", "subcategoryId", name, slug, description, "basePrice", discount, "hasGst", images, "isActive", "isFeatured", stock, sku, "createdAt", "updatedAt") VALUES
-- Grocery – Dairy & Bakery (6)
('prod_1', 'cmjmscyae000a13d1oxi4detu', 'cat_grocery', 'sub_g1', 'Fresh Whole Milk 1L', 'fresh-whole-milk-1l', 'Farm fresh whole milk', 2.99, 0, true, '["https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400"]'::jsonb, true, false, 100, 'GRC-MILK-1', NOW(), NOW()),
('prod_2', 'cmjmscyae000a13d1oxi4detu', 'cat_grocery', 'sub_g1', 'Organic Greek Yogurt 500g', 'organic-greek-yogurt-500g', 'Creamy Greek yogurt', 4.49, 0.50, true, '["https://images.unsplash.com/photo-1571212515416-d2b2c462481e?w=400"]'::jsonb, true, false, 80, 'GRC-YOG-1', NOW(), NOW()),
('prod_3', 'cmjmscyae000a13d1oxi4detu', 'cat_grocery', 'sub_g1', 'Free Range Eggs Dozen', 'free-range-eggs-dozen', '12 free range eggs', 5.99, 0, true, '["https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400"]'::jsonb, true, false, 120, 'GRC-EGG-1', NOW(), NOW()),
('prod_4', 'cmjmscyae000a13d1oxi4detu', 'cat_grocery', 'sub_g2', 'Whole Grain Bread Loaf', 'whole-grain-bread-loaf', 'Fresh baked whole grain', 3.29, 0, true, '["https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400"]'::jsonb, true, false, 60, 'GRC-BRD-1', NOW(), NOW()),
('prod_5', 'cmjmscyae000a13d1oxi4detu', 'cat_grocery', 'sub_g2', 'Croissant Pack of 4', 'croissant-pack-4', 'Buttery croissants', 4.99, 0, true, '["https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400"]'::jsonb, true, false, 50, 'GRC-CRO-1', NOW(), NOW()),
('prod_6', 'cmjmscyae000a13d1oxi4detu', 'cat_grocery', 'sub_g3', 'Mixed Salad Greens 200g', 'mixed-salad-greens-200g', 'Washed salad mix', 2.49, 0, true, '["https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400"]'::jsonb, true, false, 70, 'GRC-SAL-1', NOW(), NOW()),
-- Grocery – Snacks & Pantry (4)
('prod_7', 'cmjmscyae000a13d1oxi4detu', 'cat_grocery', 'sub_g4', 'Almonds 200g Pack', 'almonds-200g-pack', 'Roasted almonds', 6.99, 1.00, true, '["https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=400"]'::jsonb, true, false, 90, 'GRC-ALM-1', NOW(), NOW()),
('prod_8', 'cmjmscyae000a13d1oxi4detu', 'cat_grocery', 'sub_g4', 'Orange Juice 1L', 'orange-juice-1l', '100% orange juice', 3.99, 0, true, '["https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400"]'::jsonb, true, false, 85, 'GRC-OJ-1', NOW(), NOW()),
('prod_9', 'cmjmscyae000a13d1oxi4detu', 'cat_grocery', 'sub_g5', 'Extra Virgin Olive Oil 500ml', 'extra-virgin-olive-oil-500ml', 'Cold pressed olive oil', 8.99, 0, true, '["https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400"]'::jsonb, true, false, 55, 'GRC-OIL-1', NOW(), NOW()),
('prod_10', 'cmjmscyae000a13d1oxi4detu', 'cat_grocery', 'sub_g5', 'Organic Honey 350g', 'organic-honey-350g', 'Pure organic honey', 7.49, 0.50, true, '["https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400"]'::jsonb, true, false, 65, 'GRC-HON-1', NOW(), NOW()),
-- Electronics (3)
('prod_11', 'cmjmscyae000a13d1oxi4detu', 'cat_electronics', 'sub_e2', 'USB-C Hub 7-in-1', 'usb-c-hub-7in1', 'Multi-port adapter', 34.99, 5.00, true, '["https://images.unsplash.com/photo-1625723044792-44de16ccb4e9?w=400"]'::jsonb, true, false, 40, 'ELEC-HUB-1', NOW(), NOW()),
('prod_12', 'cmjmscyae000a13d1oxi4detu', 'cat_electronics', 'sub_e3', 'Wireless Earbuds', 'wireless-earbuds', 'Bluetooth 5.0 earbuds', 49.99, 10.00, true, '["https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400"]'::jsonb, true, false, 75, 'ELEC-EAR-1', NOW(), NOW()),
('prod_13', 'cmjmscyae000a13d1oxi4detu', 'cat_electronics', 'sub_e4', 'Phone Stand Aluminum', 'phone-stand-aluminum', 'Desk phone holder', 12.99, 0, true, '["https://images.unsplash.com/photo-1601784551446-20c9e07cdb31?w=400"]'::jsonb, true, false, 100, 'ELEC-STD-1', NOW(), NOW()),
-- Fashion (3)
('prod_14', 'cmjmscyae000a13d1oxi4detu', 'cat_fashion', 'sub_f1', 'Cotton T-Shirt Navy', 'cotton-tshirt-navy', '100% cotton tee', 19.99, 3.00, true, '["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400"]'::jsonb, true, false, 200, 'FASH-TS-1', NOW(), NOW()),
('prod_15', 'cmjmscyae000a13d1oxi4detu', 'cat_fashion', 'sub_f3', 'Running Sneakers White', 'running-sneakers-white', 'Lightweight running shoes', 79.99, 15.00, true, '["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400"]'::jsonb, true, false, 45, 'FASH-SHO-1', NOW(), NOW()),
('prod_16', 'cmjmscyae000a13d1oxi4detu', 'cat_fashion', 'sub_f4', 'Leather Wallet Brown', 'leather-wallet-brown', 'Genuine leather wallet', 29.99, 0, true, '["https://images.unsplash.com/photo-1627123424574-724758594e93?w=400"]'::jsonb, true, false, 60, 'FASH-WAL-1', NOW(), NOW()),
-- Home (3)
('prod_17', 'cmjmscyae000a13d1oxi4detu', 'cat_home', 'sub_h2', 'Ceramic Vase Set of 2', 'ceramic-vase-set-2', 'Decorative vases', 24.99, 4.00, true, '["https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=400"]'::jsonb, true, false, 35, 'HOME-VAS-1', NOW(), NOW()),
('prod_18', 'cmjmscyae000a13d1oxi4detu', 'cat_home', 'sub_h3', 'Stainless Steel Cutlery Set', 'stainless-steel-cutlery-set', '6-piece set', 39.99, 0, true, '["https://images.unsplash.com/photo-1584990347492-659b3e529b43?w=400"]'::jsonb, true, false, 50, 'HOME-CUT-1', NOW(), NOW()),
('prod_19', 'cmjmscyae000a13d1oxi4detu', 'cat_home', 'sub_h4', 'Garden Hose 25m', 'garden-hose-25m', 'Flexible garden hose', 18.99, 2.00, true, '["https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400"]'::jsonb, true, false, 30, 'HOME-HOS-1', NOW(), NOW()),
-- Beauty (2)
('prod_20', 'cmjmscyae000a13d1oxi4detu', 'cat_beauty', 'sub_b1', 'Moisturizing Face Cream 50ml', 'moisturizing-face-cream-50ml', 'Daily moisturizer', 22.99, 0, true, '["https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400"]'::jsonb, true, false, 80, 'BEAU-CRM-1', NOW(), NOW()),
('prod_21', 'cmjmscyae000a13d1oxi4detu', 'cat_beauty', 'sub_b3', 'Shampoo & Conditioner Set', 'shampoo-conditioner-set', 'Hair care duo', 14.99, 0, true, '["https://images.unsplash.com/photo-1522338242762-5d67450f1b35?w=400"]'::jsonb, true, false, 95, 'BEAU-SHA-1', NOW(), NOW()),
-- Sports (2)
('prod_22', 'cmjmscyae000a13d1oxi4detu', 'cat_sports', 'sub_s1', 'Yoga Mat 6mm', 'yoga-mat-6mm', 'Non-slip yoga mat', 26.99, 5.00, true, '["https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=400"]'::jsonb, true, false, 70, 'SPRT-YOG-1', NOW(), NOW()),
('prod_23', 'cmjmscyae000a13d1oxi4detu', 'cat_sports', 'sub_s2', 'Camping Flashlight LED', 'camping-flashlight-led', 'Water-resistant torch', 15.99, 0, true, '["https://images.unsplash.com/photo-1510312305653-8ed496ef75e4?w=400"]'::jsonb, true, false, 110, 'SPRT-FLA-1', NOW(), NOW()),
-- Books (2)
('prod_24', 'cmjmscyae000a13d1oxi4detu', 'cat_books', 'sub_k3', 'Notebook Set A5 3-Pack', 'notebook-set-a5-3pack', 'Ruled notebooks', 9.99, 0, true, '["https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400"]'::jsonb, true, false, 150, 'BOOK-NB-1', NOW(), NOW()),
('prod_25', 'cmjmscyae000a13d1oxi4detu', 'cat_books', 'sub_k4', 'Sketch Pencils 12-Pack', 'sketch-pencils-12pack', 'Graphite drawing set', 11.99, 1.00, true, '["https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=400"]'::jsonb, true, false, 88, 'BOOK-PEN-1', NOW(), NOW());

-- Done: 10 categories, 41 subcategories (4–5 per category), 25 products for seller cmjmscyae000a13d1oxi4detu
