import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// 1. Safety flag check
const isConfirmed = process.argv.includes('--confirm-live-delete');

// 2. Find psql.exe
const possibleBinDirs = [
  'C:\\Program Files\\PostgreSQL\\18\\bin',
  'C:\\Program Files\\PostgreSQL\\17\\bin',
  'C:\\Program Files\\PostgreSQL\\16\\bin',
  'C:\\Program Files\\pgAdmin 4\\runtime',
];

let binDir = '';
for (const dir of possibleBinDirs) {
  if (fs.existsSync(path.join(dir, 'psql.exe'))) {
    binDir = dir;
    break;
  }
}
const psql = binDir ? `"${path.join(binDir, 'psql.exe')}"` : 'psql';

// 3. Read direct Neon URL from .env
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const match = envContent.match(/^\s*DATABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?/m);
if (!match) {
  console.error('❌ DATABASE_URL not found in .env');
  process.exit(1);
}
const directNeonUrl = match[1].trim().replace('-pooler', '');

// 4. Read reference text file to parse the 98 Real Sellers
const txtPath = path.resolve(process.cwd(), 'txt', 'TEST_AND_REAL_SELLERS_LIST.txt');
const content = fs.readFileSync(txtPath, 'utf-8');

const part1Index = content.indexOf('PART 1: REAL SELLERS');
const part2Index = content.indexOf('PART 2: TEST / FAKE / DEMO SELLERS');
const part1Text = content.substring(part1Index, part2Index);

const parseEntries = (text) => {
  const regex = /\s*(\d+)\.\s+Name:\s+([^\r\n]+)\r?\n\s+Mobile:\s+([^\r\n]+)\r?\n\s+Email:\s+([^\r\n]+)/g;
  const list = [];
  let m;
  while ((m = regex.exec(text)) !== null) {
    list.push({
      num: parseInt(m[1], 10),
      rawName: m[2].trim(),
      mobile: m[3].trim().replace(/[^0-9]/g, ''),
      email: m[4].trim().toLowerCase(),
    });
  }
  return list;
};

const realList = parseEntries(part1Text);

// 5. The 4 Protected Development Accounts (STRICTLY PRESERVED)
const PROTECTED_EMAILS = [
  'productseller1@example.com',
  'jeetservice@gmail.com',
  'jobexe2893@afterdo.com',
  'naniy69646@acanok.com',
];

console.log('==================================================================');
console.log('🚀 LIVE NEON DATABASE - TEST SELLER CLEANUP SCRIPT');
console.log('==================================================================');
console.log('🔒 Safety Notice: Local DB (meeem_local) will NOT be touched.');
console.log(`🔒 Execution Mode: ${isConfirmed ? '⚡ LIVE PURGE (ACTIVE)' : '🛡️ DRY-RUN ONLY'}\n`);

// Query all sellers from Live Neon DB
const queryAllSql = `
SELECT 
  'PRODUCT_SERVICE' as type,
  s.id as seller_id,
  u.id as user_id,
  COALESCE(u.email, '') as email,
  COALESCE(u.phone, '') as phone,
  COALESCE(u.name, '') as user_name,
  COALESCE(st.name, '') as store_name
FROM sellers s
JOIN users u ON s."userId" = u.id
LEFT JOIN stores st ON st."sellerId" = s.id

UNION ALL

SELECT 
  'HOTEL' as type,
  hs.id as seller_id,
  u.id as user_id,
  COALESCE(u.email, '') as email,
  COALESCE(u.phone, hbi."pocContact", '') as phone,
  COALESCE(u.name, '') as user_name,
  COALESCE((SELECT name FROM hotels WHERE "hotelSellerId" = hs.id LIMIT 1), hbi."businessName", '') as store_name
FROM hotel_sellers hs
JOIN users u ON hs."userId" = u.id
LEFT JOIN hotel_business_info hbi ON hbi."hotelSellerId" = hs.id

UNION ALL

SELECT 
  'RESTAURANT' as type,
  rs.id as seller_id,
  u.id as user_id,
  COALESCE(u.email, '') as email,
  COALESCE(u.phone, rbi."pocContact", '') as phone,
  COALESCE(u.name, '') as user_name,
  COALESCE(rbi."businessName", '') as store_name
FROM restaurant_sellers rs
JOIN users u ON rs."userId" = u.id
LEFT JOIN restaurant_business_info rbi ON rbi."restaurantSellerId" = rs.id;
`;

const tempDir = path.resolve(process.cwd(), 'backups');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
const tempSql = path.join(tempDir, 'temp_query_live.sql');
fs.writeFileSync(tempSql, queryAllSql, 'utf-8');

const output = execSync(
  `${psql} "${directNeonUrl}" -t -A -F "|" -f "${tempSql}"`,
  { encoding: 'utf-8' }
);
fs.unlinkSync(tempSql);

const allDbSellers = output
  .split(/\r?\n/)
  .filter(l => l.trim().length > 0)
  .map(l => {
    const [type, seller_id, user_id, email, phone, user_name, store_name] = l.split('|');
    return {
      type,
      seller_id,
      user_id,
      email: email || '',
      phone: (phone || '').replace(/[^0-9]/g, ''),
      user_name: user_name || '',
      store_name: store_name || '',
    };
  });

const realSellers = [];
const protectedSellers = [];
const testSellers = [];

for (const s of allDbSellers) {
  const emailLower = s.email.toLowerCase();

  // 1. Check if Protected Dev account
  if (PROTECTED_EMAILS.includes(emailLower)) {
    protectedSellers.push(s);
    continue;
  }

  // 2. Check if Real Seller (matches realList)
  const isReal = realList.some(r => {
    if (r.email && r.email !== 'n/a' && r.email === emailLower) return true;
    if (r.mobile && r.mobile.length >= 6 && s.phone && s.phone.length >= 6 && (s.phone.endsWith(r.mobile) || r.mobile.endsWith(s.phone))) return true;
    return false;
  });

  if (isReal) {
    realSellers.push(s);
  } else {
    testSellers.push(s);
  }
}

console.log(`🛡️  PRESERVED (KEPT):`);
console.log(`  - Real Sellers:            ${realSellers.length} (Expected: 98)`);
console.log(`  - Protected Dev Accounts:  ${protectedSellers.length} (Expected: 4)`);
console.log(`  - Total Kept:              ${realSellers.length + protectedSellers.length}`);

console.log(`\n🗑️  TARGETED FOR PURGE:`);
console.log(`  - Test Sellers Count:      ${testSellers.length} (Expected: 159)`);

// STRICT VALIDATION
if (realSellers.length !== 98) {
  console.error(`❌ CRITICAL SAFETY ERROR: Real sellers count (${realSellers.length}) does not match 98! Aborting.`);
  process.exit(1);
}
if (protectedSellers.length !== 4) {
  console.error(`❌ CRITICAL SAFETY ERROR: Protected dev sellers count (${protectedSellers.length}) does not match 4! Aborting.`);
  process.exit(1);
}
if (testSellers.length !== 159) {
  console.error(`❌ CRITICAL SAFETY ERROR: Test sellers count (${testSellers.length}) does not match 159! Aborting.`);
  process.exit(1);
}

const testProdIds = testSellers.filter(s => s.type === 'PRODUCT_SERVICE').map(s => `'${s.seller_id}'`);
const testHotelIds = testSellers.filter(s => s.type === 'HOTEL').map(s => `'${s.seller_id}'`);
const testRestIds = testSellers.filter(s => s.type === 'RESTAURANT').map(s => `'${s.seller_id}'`);
const testUserIds = testSellers.map(s => `'${s.user_id}'`);

// Construct transaction SQL
const deleteScript = `
BEGIN;

-- 1. Test Orders and Bookings cleanup
DELETE FROM order_item_status_history 
WHERE "orderItemId" IN (
  SELECT id FROM order_items 
  WHERE "sellerId" IN (${testProdIds.join(',')}) 
     OR "orderId" IN (SELECT id FROM orders WHERE "sellerId" IN (${testProdIds.join(',')}))
);

DELETE FROM return_requests 
WHERE "orderItemId" IN (
  SELECT id FROM order_items 
  WHERE "sellerId" IN (${testProdIds.join(',')}) 
     OR "orderId" IN (SELECT id FROM orders WHERE "sellerId" IN (${testProdIds.join(',')}))
);

DELETE FROM order_items 
WHERE "sellerId" IN (${testProdIds.join(',')}) 
   OR "orderId" IN (SELECT id FROM orders WHERE "sellerId" IN (${testProdIds.join(',')}));

DELETE FROM payments WHERE "orderId" IN (SELECT id FROM orders WHERE "sellerId" IN (${testProdIds.join(',')}));
DELETE FROM commissions WHERE "orderId" IN (SELECT id FROM orders WHERE "sellerId" IN (${testProdIds.join(',')}));
DELETE FROM rider_delivery_assignments WHERE "orderId" IN (SELECT id FROM orders WHERE "sellerId" IN (${testProdIds.join(',')})) OR "sellerId" IN (${testProdIds.join(',')});
DELETE FROM orders WHERE "sellerId" IN (${testProdIds.join(',')});

DELETE FROM food_order_items 
WHERE "orderId" IN (SELECT id FROM food_orders WHERE "restaurantSellerId" IN (${testRestIds.join(',')}))
   OR "foodItemId" IN (SELECT id FROM food_items WHERE "restaurantSellerId" IN (${testRestIds.join(',')}));

DELETE FROM food_orders WHERE "restaurantSellerId" IN (${testRestIds.join(',')});

DELETE FROM hotel_balance_transactions WHERE "bookingId" IN (SELECT id FROM hotel_bookings WHERE "hotelId" IN (SELECT id FROM hotels WHERE "hotelSellerId" IN (${testHotelIds.join(',')})));
DELETE FROM hotel_bookings WHERE "hotelId" IN (SELECT id FROM hotels WHERE "hotelSellerId" IN (${testHotelIds.join(',')}));
DELETE FROM room_availability WHERE "roomId" IN (SELECT id FROM rooms WHERE "hotelId" IN (SELECT id FROM hotels WHERE "hotelSellerId" IN (${testHotelIds.join(',')})));
DELETE FROM rooms WHERE "hotelId" IN (SELECT id FROM hotels WHERE "hotelSellerId" IN (${testHotelIds.join(',')}));
DELETE FROM hotels WHERE "hotelSellerId" IN (${testHotelIds.join(',')});

-- 2. Test Catalog & Inventory cleanup
DELETE FROM cart_items WHERE "productId" IN (SELECT id FROM products WHERE "sellerId" IN (${testProdIds.join(',')}));
DELETE FROM wishlist_items WHERE "productId" IN (SELECT id FROM products WHERE "sellerId" IN (${testProdIds.join(',')}));
DELETE FROM recent_views WHERE "productId" IN (SELECT id FROM products WHERE "sellerId" IN (${testProdIds.join(',')}));
DELETE FROM reviews WHERE "productId" IN (SELECT id FROM products WHERE "sellerId" IN (${testProdIds.join(',')}));
DELETE FROM product_variants WHERE "productId" IN (SELECT id FROM products WHERE "sellerId" IN (${testProdIds.join(',')}));
DELETE FROM products WHERE "sellerId" IN (${testProdIds.join(',')});

DELETE FROM service_slots WHERE "serviceId" IN (SELECT id FROM services WHERE "sellerId" IN (${testProdIds.join(',')}));
DELETE FROM service_packages WHERE "serviceId" IN (SELECT id FROM services WHERE "sellerId" IN (${testProdIds.join(',')}));
DELETE FROM services WHERE "sellerId" IN (${testProdIds.join(',')});

DELETE FROM food_items WHERE "restaurantSellerId" IN (${testRestIds.join(',')});

-- 3. Test Seller Profile, Ads & Join tables
DELETE FROM ad_clicks WHERE "adId" IN (SELECT id FROM seller_ads WHERE "sellerId" IN (${testProdIds.join(',')}) OR "hotelSellerId" IN (${testHotelIds.join(',')}) OR "restaurantSellerId" IN (${testRestIds.join(',')}));
DELETE FROM seller_ads WHERE "sellerId" IN (${testProdIds.join(',')}) OR "hotelSellerId" IN (${testHotelIds.join(',')}) OR "restaurantSellerId" IN (${testRestIds.join(',')});
DELETE FROM seller_media_images WHERE "sellerId" IN (${testProdIds.join(',')});

DELETE FROM "_SellerCategories" WHERE "B" IN (${testProdIds.join(',')});
DELETE FROM "_SellerServiceCategories" WHERE "A" IN (${testProdIds.join(',')});

DELETE FROM seller_balance_transactions WHERE "sellerId" IN (${testProdIds.join(',')});
DELETE FROM hotel_balance_transactions WHERE "hotelSellerId" IN (${testHotelIds.join(',')});
DELETE FROM restaurant_balance_transactions WHERE "restaurantSellerId" IN (${testRestIds.join(',')});

DELETE FROM seller_bank_details WHERE "sellerId" IN (${testProdIds.join(',')});
DELETE FROM hotel_bank_details WHERE "hotelSellerId" IN (${testHotelIds.join(',')});
DELETE FROM restaurant_bank_details WHERE "restaurantSellerId" IN (${testRestIds.join(',')});

DELETE FROM seller_kyc WHERE "sellerId" IN (${testProdIds.join(',')});
DELETE FROM hotel_kyc WHERE "hotelSellerId" IN (${testHotelIds.join(',')});
DELETE FROM restaurant_kyc WHERE "restaurantSellerId" IN (${testRestIds.join(',')});

DELETE FROM seller_business_info WHERE "sellerId" IN (${testProdIds.join(',')});
DELETE FROM hotel_business_info WHERE "hotelSellerId" IN (${testHotelIds.join(',')});
DELETE FROM restaurant_business_info WHERE "restaurantSellerId" IN (${testRestIds.join(',')});

DELETE FROM seller_agreements WHERE "sellerId" IN (${testProdIds.join(',')});
DELETE FROM hotel_agreements WHERE "hotelSellerId" IN (${testHotelIds.join(',')});
DELETE FROM restaurant_agreements WHERE "restaurantSellerId" IN (${testRestIds.join(',')});

DELETE FROM subscriptions WHERE "sellerId" IN (${testProdIds.join(',')});
DELETE FROM hotel_subscriptions WHERE "hotelSellerId" IN (${testHotelIds.join(',')});
DELETE FROM restaurant_subscriptions WHERE "restaurantSellerId" IN (${testRestIds.join(',')});

DELETE FROM stores WHERE "sellerId" IN (${testProdIds.join(',')});

-- 4. Delete Seller records
DELETE FROM sellers WHERE id IN (${testProdIds.join(',')});
DELETE FROM hotel_sellers WHERE id IN (${testHotelIds.join(',')});
DELETE FROM restaurant_sellers WHERE id IN (${testRestIds.join(',')});

-- 5. Delete Test Users
DELETE FROM user_category_interests WHERE "userId" IN (${testUserIds.join(',')});
DELETE FROM user_addresses WHERE "userId" IN (${testUserIds.join(',')});
DELETE FROM accounts WHERE "userId" IN (${testUserIds.join(',')});
DELETE FROM sessions WHERE "userId" IN (${testUserIds.join(',')});
DELETE FROM users WHERE id IN (${testUserIds.join(',')});

COMMIT;
`;

const purgeSqlFile = path.join(tempDir, 'temp_purge_live.sql');
fs.writeFileSync(purgeSqlFile, deleteScript, 'utf-8');

if (!isConfirmed) {
  console.log('🛡️  DRY-RUN ONLY: The cleanup script was generated and validated.');
  console.log('   Run with "--confirm-live-delete" to execute the live transaction.');
} else {
  console.log('⏳ Executing transactional purge on Live Neon DB...');
  try {
    const res = execSync(
      `${psql} "${directNeonUrl}" -f "${purgeSqlFile}"`,
      { encoding: 'utf-8' }
    );
    console.log(res);
    console.log('🎉 TRANSACTION COMMITTED SUCCESSFULLY ON LIVE NEON DB!');
  } catch (err) {
    console.error('❌ TRANSACTION FAILED AND WAS ROLLED BACK:', err.message);
    process.exit(1);
  }
}

if (fs.existsSync(purgeSqlFile)) fs.unlinkSync(purgeSqlFile);
