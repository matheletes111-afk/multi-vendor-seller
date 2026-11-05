/**
 * TEST SELLER CLEANUP (05 NOV 2026) - SAFE, ID-LIST BASED
 *
 * Modes:
 *   node scripts/cleanup-test-sellers-5th-nov.mjs --generate
 *       Read-only. Classifies sellers on the LIVE DB and writes the explicit ID list to
 *       backups/test_seller_ids_5th_nov.json (also a human-readable .txt). Deletes nothing.
 *
 *   node scripts/cleanup-test-sellers-5th-nov.mjs
 *       DRY RUN (default). Re-verifies every ID on the live DB, runs the full delete inside a
 *       transaction, prints before/after row counts, then ROLLS BACK. Nothing is changed.
 *
 *   node scripts/cleanup-test-sellers-5th-nov.mjs --confirm-live-delete
 *       Same as dry run but COMMITS. Only run after reviewing the dry-run output and taking
 *       a fresh pg_dump.
 *
 * Safety: the 4 protected dev accounts, every approved seller, and every seller that has
 * products/services/foods/hotels or any order/booking are NEVER deleted.
 */
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const GENERATE = process.argv.includes('--generate');
const CONFIRM = process.argv.includes('--confirm-live-delete');
const outDir = path.resolve(process.cwd(), 'backups');
const idFile = path.join(outDir, 'test_seller_ids_5th_nov.json');

const PROTECTED_EMAILS = ['productseller1@example.com', 'jeetservice@gmail.com', 'jobexe2893@afterdo.com', 'naniy69646@acanok.com'];
const LEGIT_DOMAINS = new Set(['gmail.com', 'yahoo.com', 'icloud.com', 'live.com', 'me.com', 'outlook.com', 'hotmail.com', 'skaitelsl.com', 'theswisshotelsl.com', 'jaykayglobal.com', 'jaykaygloba.com', 'gnail.com']);
const DEV = ['srvtechnology.com', 'srvdevtesting', 'srvinfo73', 'sayanghoshdeveloper', 'vishaltester', 'somaghosh', 'jeetbasak', 'rishavbeas', 'callmevictim41', 'mail@meeemsl.com'];
const DUMMY_NAMES = ['sample user', 'sample product', 'demo user', 'demo account', 'demo restro', 'demo hotel', 'demo seller', 'abc business', 'example service', 'example hotel', 'apple', 'jhon do', 'aiuhfiuehgr', 'forgot password', 'new registration', 'new store'];

const LIST_SQL = `
SELECT 'PS' AS type, s.id, u.id AS user_id, COALESCE(u.name,'') AS name, lower(COALESCE(u.email,'')) AS email, s."isApproved" AS approved,
  (SELECT count(*) FROM products p WHERE p."sellerId"=s.id) + (SELECT count(*) FROM services sv WHERE sv."sellerId"=s.id) AS items,
  (SELECT count(*) FROM orders o WHERE o."sellerId"=s.id) + (SELECT count(*) FROM order_items oi WHERE oi."sellerId"=s.id) AS orders
FROM sellers s JOIN users u ON u.id=s."userId"
UNION ALL
SELECT 'HOTEL', h.id, u.id, COALESCE(u.name,''), lower(COALESCE(u.email,'')), h."isApproved",
  (SELECT count(*) FROM hotels WHERE "hotelSellerId"=h.id),
  (SELECT count(*) FROM hotel_bookings b JOIN hotels ht ON ht.id=b."hotelId" WHERE ht."hotelSellerId"=h.id)
FROM hotel_sellers h JOIN users u ON u.id=h."userId"
UNION ALL
SELECT 'REST', r.id, u.id, COALESCE(u.name,''), lower(COALESCE(u.email,'')), r."isApproved",
  (SELECT count(*) FROM food_items WHERE "restaurantSellerId"=r.id),
  (SELECT count(*) FROM food_orders WHERE "restaurantSellerId"=r.id)
FROM restaurant_sellers r JOIN users u ON u.id=r."userId"`;

async function fetchSellers(db) {
  const rows = await db.$queryRawUnsafe(LIST_SQL);
  return rows.map(r => ({ ...r, items: Number(r.items), orders: Number(r.orders) }));
}

function classify(s) {
  const dom = s.email.split('@')[1] || '';
  const n = s.name.toLowerCase().trim();
  if (PROTECTED_EMAILS.includes(s.email)) return { cls: 'PROTECTED' };
  if (n.includes('fwe')) return { cls: 'TEST', why: 'automated batch (fwe)' };
  if (s.email && !LEGIT_DOMAINS.has(dom)) return { cls: 'TEST', why: `burner domain @${dom}` };
  if (DEV.some(d => s.email.includes(d))) return { cls: 'TEST', why: 'dev/QA account' };
  if (DUMMY_NAMES.includes(n) || /<|alert\(/.test(s.name)) return { cls: 'TEST', why: 'dummy name' };
  return { cls: 'REAL' };
}

function buildPlan(all) {
  const del = [], keepReview = [], protectedList = [], real = [];
  for (const s of all) {
    const c = classify(s);
    if (c.cls === 'PROTECTED') protectedList.push(s);
    else if (c.cls === 'REAL') real.push(s);
    else if (s.approved || s.items > 0 || s.orders > 0) keepReview.push({ ...s, why: c.why });
    else del.push({ ...s, why: c.why });
  }
  return { del, keepReview, protectedList, real };
}

async function generate() {
  const all = await fetchSellers(prisma);
  const { del, keepReview, protectedList, real } = buildPlan(all);
  if (protectedList.length !== 4) throw new Error(`Expected 4 protected sellers, found ${protectedList.length}. Aborting.`);
  if (del.some(d => PROTECTED_EMAILS.includes(d.email))) throw new Error('Protected seller in delete list. Aborting.');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    totals: { all: all.length, real: real.length, protected: protectedList.length, toDelete: del.length, keptForReview: keepReview.length },
    delete: del.map(d => ({ type: d.type, id: d.id, userId: d.user_id, name: d.name, email: d.email, why: d.why })),
    keptForReview: keepReview.map(d => ({ type: d.type, id: d.id, name: d.name, email: d.email, approved: d.approved, items: d.items, orders: d.orders, why: d.why })),
  };
  fs.writeFileSync(idFile, JSON.stringify(payload, null, 2));
  const txt = [
    `TEST SELLERS PROPOSED FOR DELETE (${del.length})  generated ${payload.generatedAt}`,
    ...del.map((d, i) => `${String(i + 1).padStart(3)}. ${d.type.padEnd(5)} ${d.id} | ${d.name} | ${d.email || '-'} | ${d.why}`),
    '', `KEPT FOR MANUAL REVIEW - test-looking but approved / has data (${keepReview.length})`,
    ...keepReview.map(d => `  ${d.type.padEnd(5)} ${d.id} | ${d.name} | ${d.email || '-'} | approved=${d.approved} items=${d.items} orders=${d.orders}`),
  ].join('\n');
  fs.writeFileSync(idFile.replace('.json', '.txt'), txt);
  console.log(JSON.stringify(payload.totals, null, 2));
  console.log('Wrote', idFile, 'and .txt');
}

async function run() {
  if (!fs.existsSync(idFile)) throw new Error('ID file missing. Run with --generate first.');
  const plan = JSON.parse(fs.readFileSync(idFile, 'utf8'));
  // Re-verify against live right now
  const live = await fetchSellers(prisma);
  const liveById = new Map(live.map(s => [s.id, s]));
  const problems = [];
  for (const d of plan.delete) {
    const s = liveById.get(d.id);
    if (!s) { problems.push(`${d.id} no longer exists`); continue; }
    if (PROTECTED_EMAILS.includes(s.email)) problems.push(`${d.id} is PROTECTED`);
    if (s.approved) problems.push(`${d.id} (${s.name}) is now approved`);
    if (s.items > 0 || s.orders > 0) problems.push(`${d.id} (${s.name}) now has data items=${s.items} orders=${s.orders}`);
    if (classify(s).cls !== 'TEST') problems.push(`${d.id} (${s.name}) no longer classified TEST`);
  }
  if (problems.length) { console.error('ABORT - verification failed:\n' + problems.join('\n')); process.exit(1); }

  const P = plan.delete.filter(d => d.type === 'PS').map(d => d.id);
  const H = plan.delete.filter(d => d.type === 'HOTEL').map(d => d.id);
  const R = plan.delete.filter(d => d.type === 'REST').map(d => d.id);
  const userIds = plan.delete.map(d => d.userId);
  console.log(`Verified OK. Delete: ${P.length} product/service, ${H.length} hotel, ${R.length} restaurant sellers.`);
  console.log(`Mode: ${CONFIRM ? 'LIVE DELETE (COMMIT)' : 'DRY RUN (will ROLLBACK)'}\n`);

  const ROLLBACK = new Error('__ROLLBACK__');
  let summary;
  try {
    await prisma.$transaction(async tx => {
      const tables = (await tx.$queryRawUnsafe(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1`)).map(r => r.tablename);
      const count = async () => {
        const o = {};
        for (const t of tables) o[t] = Number((await tx.$queryRawUnsafe(`SELECT count(*)::int AS c FROM "${t}"`))[0].c);
        return o;
      };
      const before = await count();

      // Users safe to delete: no customer orders, not a rider, not attached to a seller that is staying
      const safeUsers = (await tx.$queryRawUnsafe(`
        SELECT u.id FROM users u WHERE u.id = ANY($1::text[])
         AND NOT EXISTS (SELECT 1 FROM orders o WHERE o."customerId"=u.id)
         AND NOT EXISTS (SELECT 1 FROM food_orders f WHERE f."customerId"=u.id)
         AND NOT EXISTS (SELECT 1 FROM riders r WHERE r."userId"=u.id)
         AND NOT EXISTS (SELECT 1 FROM sellers s WHERE s."userId"=u.id AND s.id <> ALL($2::text[]))
         AND NOT EXISTS (SELECT 1 FROM hotel_sellers h WHERE h."userId"=u.id AND h.id <> ALL($3::text[]))
         AND NOT EXISTS (SELECT 1 FROM restaurant_sellers r2 WHERE r2."userId"=u.id AND r2.id <> ALL($4::text[]))`,
        userIds, P, H, R)).map(r => r.id);

      // Seller rows: child tables are ON DELETE CASCADE in the schema
      const d1 = await tx.$executeRawUnsafe(`DELETE FROM sellers WHERE id = ANY($1::text[])`, P);
      const d2 = await tx.$executeRawUnsafe(`DELETE FROM hotel_sellers WHERE id = ANY($1::text[])`, H);
      const d3 = await tx.$executeRawUnsafe(`DELETE FROM restaurant_sellers WHERE id = ANY($1::text[])`, R);
      const d4 = await tx.$executeRawUnsafe(`DELETE FROM users WHERE id = ANY($1::text[])`, safeUsers);

      const after = await count();
      const diff = tables.filter(t => before[t] !== after[t]).map(t => ({ table: t, before: before[t], after: after[t], removed: before[t] - after[t] }));
      summary = { deleted: { sellers: d1, hotel_sellers: d2, restaurant_sellers: d3, users: d4 }, usersKeptBecauseShared: userIds.length - safeUsers.length, diff };
      // Safety assertions inside the transaction
      const prot = await tx.$queryRawUnsafe(`SELECT count(*)::int AS c FROM users WHERE lower(email) = ANY($1::text[])`, PROTECTED_EMAILS);
      if (prot[0].c !== 4) throw new Error(`Protected accounts missing after delete (${prot[0].c}/4) - rolling back`);
      if (d1 !== P.length || d2 !== H.length || d3 !== R.length) throw new Error('Deleted seller counts differ from plan - rolling back');
      if (!CONFIRM) throw ROLLBACK;
    }, { timeout: 180000, maxWait: 30000 });
    console.log('COMMITTED.');
  } catch (e) {
    if (e !== ROLLBACK) throw e;
    console.log('DRY RUN complete - transaction ROLLED BACK, nothing changed.');
  }
  console.log(JSON.stringify(summary.deleted, null, 2));
  console.log('Users kept (shared with customer orders / other roles):', summary.usersKeptBecauseShared);
  console.log('\nRows that WOULD change:' );
  for (const r of summary.diff) console.log(`  ${r.table.padEnd(34)} ${String(r.before).padStart(6)} -> ${String(r.after).padStart(6)}  (-${r.removed})`);
}

(GENERATE ? generate() : run())
  .catch(e => { console.error('ERROR:', e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

