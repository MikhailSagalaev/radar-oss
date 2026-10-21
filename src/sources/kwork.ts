import type { RawLead, SourceAdapter } from '../core/types.ts';
import { fetchText } from './http.ts';

interface KworkWant {
  id?: number | string;
  name?: string;
  description?: string;
  priceLimit?: number | string;
  possiblePriceLimit?: number | string;
  price?: number | string;
  category_id?: number | string;
  user?: { username?: string };
}

interface KworkState {
  wantsListData?: {
    pagination?: {
      data?: KworkWant[];
    };
  };
}

function parseMoney(value: number | string | undefined): number | undefined {
  if (value === undefined || value === null) return undefined;
  const parsed = Number.parseFloat(String(value).replace(/[^\d.,]/g, '').replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 500) return undefined;
  return Math.round(parsed);
}

export const kworkSource: SourceAdapter = {
  kind: 'kwork',
  access: 'public',
  description:
    'Kwork public project list. Parses the embedded page state; no account is used.',
  risks: [
    'Kwork markup can change without notice',
    'Kwork terms may restrict automated collection',
    'only the first page of projects is read',
  ],
  async poll(source, ctx): Promise<RawLead[]> {
    const categoryId =
      typeof source.config.categoryId === 'string' ? source.config.categoryId : '';
    const base = typeof source.config.url === 'string'
      ? source.config.url
      : 'https://kwork.ru/projects';
    const url = categoryId
      ? `${base}${base.includes('?') ? '&' : '?'}c=${encodeURIComponent(categoryId)}`
      : base;

    const html = await fetchText(ctx, url);
    const match = html.match(/window\.stateData\s*=\s*(\{[\s\S]*?\});/);
    if (!match?.[1]) {
      ctx.logger.warn('Kwork: window.stateData not found; markup may have changed', { url });
      return [];
    }

    let state: KworkState;
    try {
      state = JSON.parse(match[1]) as KworkState;
    } catch (error) {
      ctx.logger.warn('Kwork: failed to parse page state', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }

    const items = state.wantsListData?.pagination?.data ?? [];
    const limit = Math.max(1, Math.min(Number(source.config.limit ?? 10), 50));
    const leads: RawLead[] = [];

    for (const item of items.slice(0, limit)) {
      if (!item.id || !item.name) continue;
      const description = String(item.description ?? '').trim();
      const title = String(item.name).trim();
      const text = description ? `${title}\n\n${description}` : title;
      if (text.length < 35) continue;

      leads.push({
        sourceId: source.id,
        externalId: `kwork:${item.id}`,
        url: `https://kwork.ru/projects/${item.id}`,
        title,
        text,
        author: item.user?.username,
        budget: parseMoney(item.priceLimit ?? item.possiblePriceLimit ?? item.price),
        raw: { categoryId: item.category_id },
      });
    }

    return leads;
  },
};
