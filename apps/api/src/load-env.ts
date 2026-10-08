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
