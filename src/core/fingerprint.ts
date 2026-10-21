import { createHash } from 'node:crypto';
import { normalizeForMatch } from './text.ts';

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Title key is deliberately lossy: it catches the same order reposted on
 * another board with a different URL and slightly different punctuation.
 */
export function titleKeyOf(title: string): string {
  return normalizeForMatch(title)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

export function fingerprintOf(input: {
  canonicalUrl?: string;
  title: string;
  text: string;
}): string {
  const basis = input.canonicalUrl
    ? `url:${input.canonicalUrl}`
    : `text:${titleKeyOf(input.title)}|${normalizeForMatch(input.text).slice(0, 600)}`;
  return sha256(basis);
}
