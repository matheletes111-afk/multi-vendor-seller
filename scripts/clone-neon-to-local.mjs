import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// 1. Ensure backups directory exists
const backupDir = path.resolve(process.cwd(), 'backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// 2. Find PostgreSQL bin directory
const possibleBinDirs = [
  'C:\\Program Files\\PostgreSQL\\18\\bin',
  'C:\\Program Files\\PostgreSQL\\17\\bin',
  'C:\\Program Files\\PostgreSQL\\16\\bin',
  'C:\\Program Files\\pgAdmin 4\\runtime',
];

let binDir = '';
for (const dir of possibleBinDirs) {
  if (fs.existsSync(path.join(dir, 'pg_dump.exe'))) {
    binDir = dir;
    break;
  }
}

const pgDump = binDir ? `"${path.join(binDir, 'pg_dump.exe')}"` : 'pg_dump';
const pgRestore = binDir ? `"${path.join(binDir, 'pg_restore.exe')}"` : 'pg_restore';
const psql = binDir ? `"${path.join(binDir, 'psql.exe')}"` : 'psql';

// 3. Read DATABASE_URL from .env
const envPath = path.resolve(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ .env file not found!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const match = envContent.match(/^\s*DATABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?/m);

if (!match) {
  console.error('❌ DATABASE_URL not found in .env!');
  process.exit(1);
}

let neonUrl = match[1].trim();
// Use direct connection (bypass pgbouncer pooler for pg_dump reliability)
const directNeonUrl = neonUrl.replace('-pooler', '');

// Local DB settings
const LOCAL_USER = process.env.LOCAL_PG_USER || 'postgres';
const LOCAL_PASSWORD = process.env.LOCAL_PG_PASSWORD || '11111111';
const LOCAL_HOST = process.env.LOCAL_PG_HOST || 'localhost';
const LOCAL_PORT = process.env.LOCAL_PG_PORT || '5432';
const LOCAL_DB = process.env.LOCAL_PG_DB || 'meeem_local';

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(backupDir, `neon_backup_${timestamp}.dump`);

console.log('====================================================');
console.log('🚀 LIVE NEON DB -> LOCAL DB CLONE SCRIPT');
console.log('====================================================');
console.log(`🔒 Read-Only safety: Live Neon DB will ONLY be read, never modified.`);
console.log(`📦 Backup file target: ${backupFile}`);
console.log(`🎯 Local DB target: ${LOCAL_DB} on ${LOCAL_HOST}:${LOCAL_PORT}`);
console.log('----------------------------------------------------');

try {
  // Step 1: Dump from Neon
  console.log('⏳ Step 1/2: Downloading live data & schema from Neon DB...');
  const dumpCmd = `${pgDump} "${directNeonUrl}" -Fc --no-owner --no-privileges -f "${backupFile}"`;
  execSync(dumpCmd, { stdio: 'inherit' });
  
  const stats = fs.statSync(backupFile);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`✅ Step 1 complete: Backup saved (${sizeMB} MB)\n`);

  // Step 2: Restore into local DB
  console.log(`⏳ Step 2/2: Restoring data into local database "${LOCAL_DB}"...`);
  const restoreCmd = `${pgRestore} -U ${LOCAL_USER} -h ${LOCAL_HOST} -p ${LOCAL_PORT} -d ${LOCAL_DB} --clean --if-exists --no-owner --no-privileges "${backupFile}"`;
  
  execSync(restoreCmd, {
    env: { ...process.env, PGPASSWORD: LOCAL_PASSWORD },
    stdio: 'inherit',
  });
  console.log(`✅ Step 2 complete: Local database "${LOCAL_DB}" is fully restored!\n`);

  // Step 3: Verification
  console.log('📊 Verifying row counts in local database:');
  const query = `
    SELECT 'users' as table_name, count(*) as count from users
    UNION ALL SELECT 'products', count(*) from products
    UNION ALL SELECT 'food_items', count(*) from food_items
    UNION ALL SELECT 'orders', count(*) from orders
    UNION ALL SELECT 'sellers', count(*) from sellers
    UNION ALL SELECT 'stores', count(*) from stores;
  `;
  const verifyCmd = `${psql} -U ${LOCAL_USER} -h ${LOCAL_HOST} -p ${LOCAL_PORT} -d ${LOCAL_DB} -c "${query}"`;
  execSync(verifyCmd, {
    env: { ...process.env, PGPASSWORD: LOCAL_PASSWORD },
    stdio: 'inherit',
  });

  console.log('====================================================');
  console.log('🎉 CLONING FINISHED SUCCESSFULLY!');
  console.log(`📁 Backup preserved in: ${backupFile}`);
  console.log('====================================================');
} catch (error) {
  console.error('❌ Error during clone:', error.message);
  process.exit(1);
}
