import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const developmentJwtSecret = 'kla_foodizo_obunuzi_secure_session_key_2026_kampala_fast_casual';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('http://localhost:3000,http://127.0.0.1:3000'),
  DATABASE_URL: z.string().default('postgresql://foodizo_admin:WandegeyaSecure2026@localhost:5432/foodizo_obunuzi_db?schema=public'),
  JWT_SECRET: z.string().min(16).default(developmentJwtSecret),
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

  // Telco callbacks. Production startup requires a signing secret; development
  // and test may use unsigned callbacks.
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

export function loadConfig(environment: NodeJS.ProcessEnv = process.env) {
  const parsed = envSchema.parse(environment);
  const renderExternalUrl = environment.RENDER_EXTERNAL_URL;
  let renderOrigin: string | undefined;
  if (renderExternalUrl) {
    try {
      const url = new URL(renderExternalUrl);
      if (url.protocol === 'https:') renderOrigin = url.origin;
    } catch {
      renderOrigin = undefined;
    }
  }
  const effective = {
    ...parsed,
    ...(parsed.NODE_ENV === 'production' && renderOrigin
      ? {
          CORS_ORIGIN: environment.CORS_ORIGIN || renderOrigin,
          DIGEST_APP_URL: environment.DIGEST_APP_URL || renderOrigin
        }
      : {})
  };

  if (effective.NODE_ENV === 'production') {
    const invalid: string[] = [];
    const isHttpsUrl = (value: string | undefined) => {
      if (!value) return false;
      try {
        return new URL(value).protocol === 'https:';
      } catch {
        return false;
      }
    };

    if (!environment.DATABASE_URL) invalid.push('DATABASE_URL must be set');
    if (
      !environment.JWT_SECRET ||
      environment.JWT_SECRET.length < 32 ||
      environment.JWT_SECRET === developmentJwtSecret
    ) {
      invalid.push('JWT_SECRET must be a unique value of at least 32 characters');
    }
    if (!environment.PAYMENTS_WEBHOOK_SECRET || environment.PAYMENTS_WEBHOOK_SECRET.length < 32) {
      invalid.push('PAYMENTS_WEBHOOK_SECRET must be set to at least 32 characters');
    }
    if (effective.HOST !== '127.0.0.1') invalid.push('HOST must be 127.0.0.1');

    const origins = effective.CORS_ORIGIN.split(',').map((origin) => origin.trim());
    if (
      origins.length === 0 ||
      origins.some((origin) => {
        if (!isHttpsUrl(origin)) return true;
        const hostname = new URL(origin).hostname;
        return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
      })
    ) {
      invalid.push('CORS_ORIGIN must contain only HTTPS origins');
    }
    if (!isHttpsUrl(effective.DIGEST_APP_URL)) {
      invalid.push('DIGEST_APP_URL must be an HTTPS URL');
    }

    if (invalid.length > 0) {
      throw new Error(`Invalid production configuration: ${invalid.join('; ')}`);
    }
  }

  return effective;
}

export const config = loadConfig();
