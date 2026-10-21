import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSourceRegistry } from '../src/sources/index.ts';
import { makeSource, pollContext, TEST_NOW } from './helpers.ts';

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
}

describe('source adapters', () => {
  const registry = createSourceRegistry();

  it('parses an RSS feed', async () => {
    const adapter = registry.get('rss');
    expect(adapter?.poll).toBeTypeOf('function');
    const leads = await adapter!.poll!(
      makeSource({ config: { url: 'https://example.com/rss' } }),
      pollContext(fixture('rss.xml')),
    );
    expect(leads).toHaveLength(1);
    expect(leads[0]?.title).toContain('сантехник');
    expect(leads[0]?.url).toContain('utm_source=rss');
    expect(leads[0]?.externalId).toBe('order-1');
  });

  it('parses a public Telegram channel preview', async () => {
    const adapter = registry.get('telegram');
    const leads = await adapter!.poll!(
      makeSource({ kind: 'telegram', config: { channel: '@test' } }),
      pollContext(fixture('telegram.html')),
    );
    expect(leads).toHaveLength(2);
    expect(leads[0]?.externalId).toBe('tg:test:1');
    expect(leads[0]?.url).toBe('https://t.me/test/1');
    expect(leads[0]?.publishedAt).toBe('2026-10-21T10:00:00+00:00');
  });

  it('parses Kwork page state', async () => {
    const adapter = registry.get('kwork');
    const leads = await adapter!.poll!(
      makeSource({ kind: 'kwork' }),
      pollContext(fixture('kwork.html')),
    );
    expect(leads).toHaveLength(1);
    expect(leads[0]?.title).toBe('Сделать лендинг для кофейни');
    expect(leads[0]?.budget).toBe(15000);
    expect(leads[0]?.externalId).toBe('kwork:123');
  });

  it('does not expose a poll function for webhook sources', () => {
    const adapter = registry.get('webhook');
    expect(adapter).toBeDefined();
    expect(adapter?.poll).toBeUndefined();
    expect(adapter?.access).toBe('user-provided');
  });
});
