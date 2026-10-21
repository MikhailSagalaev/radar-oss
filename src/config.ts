import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import type { Env } from './core/types.ts';

loadDotenv({ quiet: true });

const optionalString = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  });

const booleanFromEnv = (defaultValue: boolean) =>
  z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined) return defaultValue;
      return value === 'true' || value === '1' || value === 'yes';
    });

const envSchema = z.object({
  RADAR_DB_PATH: z.string().min(1).default('./data/radar.db'),
  RADAR_ADMIN_TOKEN: optionalString,
  RADAR_USER_AGENT: z
    .string()
    .default('RadarBot/0.1 (+https://github.com/your-org/radar)'),
  RADAR_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  RADAR_POLL_INTERVAL_SEC: z.coerce.number().int().positive().default(300),
  RADAR_LLM_ENABLED: booleanFromEnv(false),
  OPENAI_API_KEY: optionalString,
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  TELEGRAM_BOT_TOKEN: optionalString,
  TELEGRAM_CHAT_ID: optionalString,
  WEBHOOK_URL: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  WEBHOOK_SECRET: optionalString,
  RADAR_CONSOLE_SINK: booleanFromEnv(true),
  RADAR_PUBLIC_READ: booleanFromEnv(false),
  RADAR_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  PORT: z.coerce.number().int().positive().default(8787),
});

export function loadEnv(overrides: Partial<Env> = {}): Env {
  const parsed = envSchema.parse(process.env);
  return { ...parsed, ...overrides };
}
