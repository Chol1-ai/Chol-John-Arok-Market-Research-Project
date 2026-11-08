import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('http://localhost:3000,http://127.0.0.1:3000'),
  DATABASE_URL: z.string().default('postgresql://foodizo_admin:WandegeyaSecure2026@localhost:5432/foodizo_obunuzi_db?schema=public'),
  JWT_SECRET: z.string().min(16).default('kla_foodizo_obunuzi_secure_session_key_2026_kampala_fast_casual'),
  JWT_EXPIRATION_HOURS: z.coerce.number().default(12),
  
  // MoMo & SMS
  MTN_MOMO_PRIMARY_KEY: z.string().default('sandbox_key'),
  MTN_MOMO_USER_ID: z.string().default('sandbox_user'),
  MTN_MOMO_API_KEY: z.string().default('sandbox_api_key'),
  MTN_MOMO_TARGET_ENV: z.string().default('sandbox'),
  MTN_MOMO_CALLBACK_HOST: z.string().default('http://localhost:4000'),
  
  AIRTEL_MONEY_CLIENT_ID: z.string().default('sandbox_client_id'),
  AIRTEL_MONEY_CLIENT_SECRET: z.string().default('sandbox_secret'),
  AIRTEL_MONEY_ENV: z.string().default('sandbox'),

  // Telco callbacks. Set PAYMENTS_WEBHOOK_SECRET in production; when it is
  // empty the route only accepts unsigned callbacks in development/test and
  // refuses to process them in production (secure default).
  PAYMENTS_WEBHOOK_SECRET: z.string().default(''),

  AFRICASTALKING_USERNAME: z.string().default('sandbox'),
  AFRICASTALKING_API_KEY: z.string().default('sandbox_key'),
  SMS_SENDER_ID: z.string().default('FOODIZO'),
  
  // Hardware
  EXPO_PRINTER_IP: z.string().default('192.168.1.200'),
  EXPO_PRINTER_PORT: z.coerce.number().default(9100),
  CASH_DRAWER_KICK_ENABLED: z.coerce.number().default(1),
  
  // Nightly Digest
  DIGEST_CRON_SCHEDULE: z.string().default('30 21 * * *'),
  DIGEST_RECIPIENT_PHONE: z.string().default('+256772000000'),
  DIGEST_RECIPIENT_EMAIL: z.string().default('zito.mbowe@foodizo.ug'),
  DIGEST_APP_URL: z.string().default('http://localhost:3000'),
  // Phase 1 has no SMTP transport in this repo. Keep the channel honest:
  // "NOT_CONFIGURED" is reported until a real mailer is wired.
  // z.coerce.boolean() treats the string "false" as true, so parse explicitly.
  DIGEST_EMAIL_ENABLED: z
    .enum(['true', 'false', '1', '0'])
    .default('false')
    .transform((value) => value === 'true' || value === '1')
});

export const config = envSchema.parse(process.env);

