import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const envPath = fileURLToPath(new URL('../../.env', import.meta.url));

export function loadToolEnv(): void {
  loadEnv({ path: envPath });
}

