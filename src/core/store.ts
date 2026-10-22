import type {
  Lead,
  LeadStatus,
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
}

export interface Store {
  listSources(): Promise<SourceRecord[]> | SourceRecord[];
  getSource(id: string): Promise<SourceRecord | null> | SourceRecord | null;
  createSource(input: CreateSourceInput): Promise<SourceRecord> | SourceRecord;
  updateSource(id: string, patch: UpdateSourceInput): Promise<SourceRecord | null> | SourceRecord | null;
  deleteSource(id: string): Promise<boolean> | boolean;

  findLeadByFingerprint(fingerprint: string): Promise<Lead | null> | Lead | null;
  getLead(id: string): Promise<Lead | null> | Lead | null;
  findRecentByTitleKey(titleKey: string, city: string | undefined, sinceIso: string): Promise<Lead | null> | Lead | null;
  insertLead(lead: Lead): Promise<boolean> | boolean;
  updateLeadStatus(id: string, status: LeadStatus, deliveredAt?: string): Promise<void> | void;
  listLeads(options?: ListLeadsOptions): Promise<Lead[]> | Lead[];
  getStats(): Promise<Stats> | Stats;
  getSourceHealth(): Promise<SourceHealth[]> | SourceHealth[];

  recordRun(run: RunRecord): Promise<void> | void;
  listRuns(limit?: number, sourceId?: string): Promise<RunRecord[]> | RunRecord[];
  recordDelivery(leadId: string, sink: string, status: 'sent' | 'failed', error?: string): Promise<void> | void;

  close(): Promise<void> | void;
}
