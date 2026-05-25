import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('3001').transform(Number),

  // Database
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  // Auth
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters long"),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // CORS
  ALLOWED_ORIGINS: z.string().default('').transform((val) => val.split(',').map((origin) => origin.trim()).filter(Boolean)),

  // Redis (Optional for now, but good to have)
  REDIS_URL: z.string().url().optional(),

  // Backup
  BACKUP_ENABLED: z.string().default('true').transform((val) => val === 'true'),
  BACKUP_RETENTION_DAYS: z.string().default('30').transform(Number),

  // Email (Optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),

  // Integration Keys
  GEMINI_API_KEY: z.string().optional(),
  MPESA_API_KEY: z.string().optional(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(_env.error.format(), null, 2));
  process.exit(1);
}

export const env = _env.data;
