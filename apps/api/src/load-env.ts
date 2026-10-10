import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Load environment variables from the monorepo root `.env` (and an optional
 * app-level `.env`) before anything else reads `process.env`.
 * Real environment variables always win.
 */
for (const file of [resolve(__dirname, '../../../.env'), resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
  if (existsSync(file)) {
    try {
      process.loadEnvFile(file);
    } catch {
      // ignore malformed files; validation in AppConfig reports missing values
    }
    break;
  }
}

/**
 * Forgive the two most common copy-paste mistakes from the Supabase dashboard:
 *  - SUPABASE_URL copied with a path (e.g. `.../rest/v1/`) — clients need the bare project origin.
 *  - DATABASE_URL on the transaction pooler (port 6543) without `pgbouncer=true`, which makes Prisma
 *    fail with `prepared statement "s0" already exists`.
 */
const supabaseUrl = process.env.SUPABASE_URL?.trim();
if (supabaseUrl) {
  try {
    process.env.SUPABASE_URL = new URL(supabaseUrl).origin;
  } catch {
    // leave as-is; the Supabase client reports the invalid URL
  }
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    if (url.port === '6543' && !url.searchParams.has('pgbouncer')) {
      url.searchParams.set('pgbouncer', 'true');
      process.env.DATABASE_URL = url.toString();
    }
  } catch {
    // leave as-is; Prisma reports the invalid connection string
  }
}
