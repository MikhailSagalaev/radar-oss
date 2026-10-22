import { cleanTitle, extractBudget, extractCity } from './extract.ts';
import { fingerprintOf, titleKeyOf } from './fingerprint.ts';
import { toPlainText } from './text.ts';
import type { RawLead, SourceRecord } from './types.ts';
import { canonicalizeUrl, isHttpUrl } from './url.ts';

export interface PreparedLead extends RawLead {
  canonicalUrl?: string;
  titleKey: string;
  fingerprint: string;
  publishedAtDate: Date;
}

function parsePublishedAt(value: string | undefined, now: Date): Date {
  if (!value) return now;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return now;
  if (parsed.getTime() > now.getTime() + 60 * 60 * 1000) return now;
  return parsed;
}

export function prepareRawLead(
  raw: RawLead,
  source: SourceRecord,
  now: Date,
): PreparedLead {
  const text = toPlainText(raw.text || '');
  const title = cleanTitle(raw.title, text);
  const normalizedText = text || title;
  const url = raw.url?.trim();
  const safeHttpUrl = url && isHttpUrl(url) ? url : undefined;
  const canonicalUrl = safeHttpUrl ? canonicalizeUrl(safeHttpUrl) : undefined;

  const explicitBudget =
    typeof raw.budget === 'number' && Number.isFinite(raw.budget) && raw.budget >= 0
      ? raw.budget
      : undefined;
  const budget = explicitBudget ?? extractBudget(`${title}\n${normalizedText}`);

  const explicitCity = raw.city?.trim();
  const extractedCity = extractCity(`${title}\n${normalizedText}`);
  const configuredCity =
    typeof source.config.city === 'string' ? source.config.city.trim() : '';
  const city = explicitCity || extractedCity || configuredCity || undefined;

  const publishedAtDate = parsePublishedAt(raw.publishedAt, now);
  const titleKey = titleKeyOf(title);
  const fingerprint = fingerprintOf({ canonicalUrl, title, text: normalizedText });

  return {
    ...raw,
    title,
    text: normalizedText,
    url: canonicalUrl ?? safeHttpUrl,
    canonicalUrl,
    budget,
    city,
    publishedAt: publishedAtDate.toISOString(),
    publishedAtDate,
    titleKey,
    fingerprint,
    externalId:
      raw.externalId?.trim() ||
      canonicalUrl ||
      `${source.id}:${fingerprint.slice(0, 16)}`,
  };
}
