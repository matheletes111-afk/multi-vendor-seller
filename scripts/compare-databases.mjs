import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// 1. Find PostgreSQL bin directory
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

// 2. Read DATABASE_URL from .env
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const match = envContent.match(/^\s*DATABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?/m);
if (!match) {
  console.error('❌ DATABASE_URL not found in .env');
  process.exit(1);
}

const neonUrl = match[1].trim().replace('-pooler', '');

const LOCAL_USER = process.env.LOCAL_PG_USER || 'postgres';
const LOCAL_PASSWORD = process.env.LOCAL_PG_PASSWORD || '11111111';
const LOCAL_HOST = process.env.LOCAL_PG_HOST || 'localhost';
const LOCAL_PORT = process.env.LOCAL_PG_PORT || '5432';
const LOCAL_DB = process.env.LOCAL_PG_DB || 'meeem_local';

console.log('Fetching table list from Local DB...');
const listTablesSql = "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;";

const tempDir = path.resolve(process.cwd(), 'backups');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

const listSqlFile = path.join(tempDir, 'temp_list_tables.sql');
fs.writeFileSync(listSqlFile, listTablesSql, 'utf-8');

const tablesRaw = execSync(
  `${psql} -U ${LOCAL_USER} -h ${LOCAL_HOST} -p ${LOCAL_PORT} -d ${LOCAL_DB} -t -A -f "${listSqlFile}"`,
  {
    env: { ...process.env, PGPASSWORD: LOCAL_PASSWORD },
    encoding: 'utf-8',
  }
);
fs.unlinkSync(listSqlFile);

const tables = tablesRaw
  .split(/\r?\n/)
  .map(t => t.trim())
  .filter(Boolean);

console.log(`Found ${tables.length} tables. Comparing row counts between Live Neon DB and Local DB (${LOCAL_DB})...\n`);

// Build a clean SQL file using double-quoted identifiers
const countQueries = tables.map(t => `SELECT '${t}' AS tbl, count(*) AS cnt FROM "${t}"`).join('\nUNION ALL\n');
const fullQuery = `WITH counts AS (\n${countQueries}\n)\nSELECT tbl, cnt FROM counts ORDER BY tbl;\n`;

const compareSqlFile = path.join(tempDir, 'temp_compare.sql');
fs.writeFileSync(compareSqlFile, fullQuery, 'utf-8');

console.log('Querying Local DB...');
const localCountsRaw = execSync(
  `${psql} -U ${LOCAL_USER} -h ${LOCAL_HOST} -p ${LOCAL_PORT} -d ${LOCAL_DB} -t -A -F "|" -f "${compareSqlFile}"`,
  {
    env: { ...process.env, PGPASSWORD: LOCAL_PASSWORD },
    encoding: 'utf-8',
  }
);

console.log('Querying Live Neon DB...');
const neonCountsRaw = execSync(
  `${psql} "${neonUrl}" -t -A -F "|" -f "${compareSqlFile}"`,
  {
    encoding: 'utf-8',
  }
);

// Cleanup temp SQL
if (fs.existsSync(compareSqlFile)) fs.unlinkSync(compareSqlFile);

const parseCounts = (raw) => {
  const map = new Map();
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [tbl, cnt] = line.split('|');
    if (tbl) {
      map.set(tbl.trim(), parseInt(cnt?.trim() || '0', 10));
    }
  }
  return map;
};

const localMap = parseCounts(localCountsRaw);
const neonMap = parseCounts(neonCountsRaw);

console.log('---------------------------------------------------------------------------------');
console.log(
  'Table Name'.padEnd(35) +
  ' | ' +
  'Neon Live'.padStart(10) +
  ' | ' +
  'Local DB'.padStart(10) +
  ' | ' +
  'Status'
);
console.log('------------------------------------+------------+------------+------------------');

let totalNeon = 0;
let totalLocal = 0;
let mismatches = 0;

for (const table of tables) {
  const neonCount = neonMap.has(table) ? neonMap.get(table) : 'N/A';
  const localCount = localMap.has(table) ? localMap.get(table) : 'N/A';

  if (typeof neonCount === 'number') totalNeon += neonCount;
  if (typeof localCount === 'number') totalLocal += localCount;

  const match = neonCount === localCount;
  if (!match) mismatches++;

  const statusStr = match ? '✅ MATCH' : `❌ MISMATCH (diff: ${neonCount - localCount})`;

  console.log(
    table.padEnd(35) +
    ' | ' +
    String(neonCount).padStart(10) +
    ' | ' +
    String(localCount).padStart(10) +
    ' | ' +
    statusStr
  );
}

console.log('------------------------------------+------------+------------+------------------');
console.log(
  'TOTAL'.padEnd(35) +
  ' | ' +
  String(totalNeon).padStart(10) +
  ' | ' +
  String(totalLocal).padStart(10) +
  ' | ' +
  (mismatches === 0 ? '✅ 100% IDENTICAL' : `❌ ${mismatches} MISMATCHES`)
);
console.log('---------------------------------------------------------------------------------');
console.log(`Summary: Total tables: ${tables.length} | Mismatches: ${mismatches}`);
