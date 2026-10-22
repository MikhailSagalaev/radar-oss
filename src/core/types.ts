export type SourceKind = 'rss' | 'telegram' | 'kwork' | 'webhook' | 'imap';
export type AccessKind = 'official' | 'public' | 'user-provided' | 'auth-required';
export type LeadStatus = 'new' | 'delivered' | 'duplicate' | 'rejected' | 'failed';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
  child(scope: string): Logger;
}

export interface Env {
  DATABASE_URL?: string;
  RADAR_DB_PATH: string;
  RADAR_ADMIN_TOKEN?: string;
  RADAR_USER_AGENT: string;
  RADAR_HTTP_TIMEOUT_MS: number;
  RADAR_POLL_INTERVAL_SEC: number;
  RADAR_LLM_ENABLED: boolean;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL: string;
  OPENAI_MODEL: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  WEBHOOK_URL?: string;
  WEBHOOK_SECRET?: string;
  RADAR_CONSOLE_SINK: boolean;
  RADAR_PUBLIC_READ: boolean;
  RADAR_LOG_LEVEL: LogLevel;
  PORT: number;
}

export interface SourceConfig {
  url?: string;
  channel?: string;
  categoryId?: string;
  city?: string;
  includeKeywords?: string[];
  excludeKeywords?: string[];
  minBudget?: number;
  maxAgeHours?: number;
  limit?: number;
  token?: string;
  [key: string]: unknown;
}

export interface SourceRecord {
  id: string;
  kind: SourceKind;
  title: string;
  enabled: boolean;
  config: SourceConfig;
  createdAt: string;
  updatedAt: string;
}

export interface RawLead {
  sourceId: string;
  externalId?: string;
  url?: string;
  title: string;
  text: string;
  author?: string;
  city?: string;
  budget?: number;
  currency?: string;
  category?: string;
  skills?: string[];
  isRemote?: boolean;
  publishedAt?: string;
  metadata?: Record<string, unknown>;
  raw?: Record<string, unknown>;
}

export interface Lead extends RawLead {
  id: string;
  canonicalUrl?: string;
  fingerprint: string;
  titleKey: string;
  status: LeadStatus;
  score: number;
  reasons: string[];
  createdAt: string;
  deliveredAt?: string;
}

export interface PollContext {
  fetchImpl: typeof fetch;
  userAgent: string;
  timeoutMs: number;
  logger: Logger;
  now: () => Date;
}

export interface SourceAdapter {
  kind: SourceKind;
  access: AccessKind;
  description: string;
  risks: string[];
  /** Webhook sources have no poll function; they are fed by the HTTP API. */
  poll?(source: SourceRecord, ctx: PollContext): Promise<RawLead[]>;
}

export interface SinkContext {
  fetchImpl: typeof fetch;
  logger: Logger;
  env: Env;
}

export interface SinkAdapter {
  kind: string;
  deliver(lead: Lead, ctx: SinkContext): Promise<void>;
}

export interface Classification {
  isLead: boolean;
  confidence: number;
  category?: string;
  city?: string;
  summary?: string;
  skills?: string[];
  estimatedBudget?: number;
  urgency?: 'low' | 'medium' | 'high';
}

export interface ClassifierInput {
  title: string;
  text: string;
  city?: string;
  budget?: number;
}

export interface Classifier {
  classify(lead: ClassifierInput): Promise<Classification | null>;
}

export interface RunRecord {
  id: string;
  sourceId: string;
  startedAt: string;
  finishedAt?: string;
  found: number;
  inserted: number;
  duplicates: number;
  rejected: number;
  delivered: number;
  error?: string;
}

export interface Stats {
  sources: number;
  enabledSources: number;
  leads: number;
  newLeads: number;
  deliveredLeads: number;
  rejectedLeads: number;
  last24h: number;
}

export interface SourceHealth {
  source: SourceRecord;
  lastRun?: RunRecord;
  last24h: {
    found: number;
    inserted: number;
    duplicates: number;
    rejected: number;
    delivered: number;
    errors: number;
    runs: number;
  };
  successRate: number;
}
