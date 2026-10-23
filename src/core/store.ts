import type {
  Lead,
  LeadStatus,
  LeadType,
  RunRecord,
  SourceConfig,
  SourceHealth,
  SourceKind,
  SourceRecord,
  Stats,
} from './types.ts';

export interface CreateSourceInput {
  id?: string;
  kind: SourceKind;
  title: string;
  config?: SourceConfig;
  enabled?: boolean;
}

export interface UpdateSourceInput {
  title?: string;
  enabled?: boolean;
  config?: SourceConfig;
}

export interface ListLeadsOptions {
  limit?: number;
  status?: LeadStatus;
  sourceId?: string;
  query?: string;
  type?: LeadType;
}

export interface LeadDeliveryRecord {
  leadId: string;
  sink: string;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  nextAttemptAt: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Store {
  init?(): Promise<void>;
  listSources(): Promise<SourceRecord[]>;
  getSource(id: string): Promise<SourceRecord | null>;
  createSource(input: CreateSourceInput): Promise<SourceRecord>;
  updateSource(id: string, patch: UpdateSourceInput): Promise<SourceRecord | null>;
  deleteSource(id: string): Promise<boolean>;

  findLeadByFingerprint(fingerprint: string): Promise<Lead | null>;
  getLead(id: string): Promise<Lead | null>;
  findRecentByTitleKey(titleKey: string, city: string | undefined, sinceIso: string): Promise<Lead | null>;
  insertLead(lead: Lead): Promise<boolean>;
  updateLeadStatus(id: string, status: LeadStatus, deliveredAt?: string, scoreDelta?: number): Promise<void>;
  recordVote(
    leadId: string,
    signal: 'useful' | 'junk' | 'scam' | 'closed',
    weight?: number,
  ): Promise<{
    votes_up: number;
    votes_down: number;
    votes_scam: number;
    votes_closed: number;
    score: number;
  }>;
  listLeads(options?: ListLeadsOptions): Promise<Lead[]>;
  getStats(): Promise<Stats>;
  getSourceHealth(): Promise<SourceHealth[]>;

  recordRun(run: RunRecord): Promise<void>;
  listRuns(limit?: number, sourceId?: string): Promise<RunRecord[]>;
  recordDelivery(leadId: string, sink: string, status: 'sent' | 'failed', error?: string): Promise<void>;

  initLeadDeliveries?(leadId: string, sinks: string[]): Promise<void>;
  updateLeadDelivery?(leadId: string, sink: string, status: 'sent' | 'failed', error?: string, nextAttemptAt?: string): Promise<void>;
  getPendingDeliveries?(limit?: number): Promise<LeadDeliveryRecord[]>;
  getLeadDeliveries?(leadId: string): Promise<LeadDeliveryRecord[]>;

  createSession?(sessionId: string, expiresAt: string): Promise<void>;
  validateSession?(sessionId: string): Promise<boolean>;
  deleteSession?(sessionId: string): Promise<void>;

  deleteLead?(id: string): Promise<boolean>;
  cleanupOldLeads?(retentionDays: number): Promise<number>;

  close(): Promise<void>;
}
