import { z } from 'zod';

const envSchema = z.object({
  VITE_API_URL: z.string().url().default('http://localhost:3001/api'),
  MODE: z.enum(['development', 'production', 'test']).default('development'),
});

// Parse import.meta.env
const _env = envSchema.safeParse(import.meta.env);

if (!_env.success) {
  console.error('❌ Invalid frontend environment variables:');
  console.error(JSON.stringify(_env.error.format(), null, 2));
  // In frontend, we don't process.exit(1), but we can throw an error to halt the app
  throw new Error('Invalid environment variables');
}

export const env = _env.data;

/** Backend host without the /api suffix — for static asset URLs (uploads, reports). */
export const API_HOST = env.VITE_API_URL.replace(/\/api\/?$/, '');
