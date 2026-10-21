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
}

export interface Store {
  listSources(): SourceRecord[];
  getSource(id: string): SourceRecord | null;
  createSource(input: CreateSourceInput): SourceRecord;
  updateSource(id: string, patch: UpdateSourceInput): SourceRecord | null;
  deleteSource(id: string): boolean;

  findLeadByFingerprint(fingerprint: string): Lead | null;
  findRecentByTitleKey(titleKey: string, city: string | undefined, sinceIso: string): Lead | null;
  insertLead(lead: Lead): boolean;
  updateLeadStatus(id: string, status: LeadStatus, deliveredAt?: string): void;
  listLeads(options?: ListLeadsOptions): Lead[];
  getStats(): Stats;
  getSourceHealth(): SourceHealth[];

  recordRun(run: RunRecord): void;
  listRuns(limit?: number, sourceId?: string): RunRecord[];
  recordDelivery(leadId: string, sink: string, status: 'sent' | 'failed', error?: string): void;

  close(): void;
}
