import type { SinkAdapter } from '../core/types.ts';

export const webhookSink: SinkAdapter = {
  kind: 'webhook',
  async deliver(lead, ctx): Promise<void> {
    const url = ctx.env.WEBHOOK_URL;
    if (!url) throw new Error('WEBHOOK_URL is not configured');

    const response = await ctx.fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(ctx.env.WEBHOOK_SECRET ? { 'x-radar-secret': ctx.env.WEBHOOK_SECRET } : {}),
      },
      body: JSON.stringify({
        event: 'lead.created',
        lead: {
          id: lead.id,
          sourceId: lead.sourceId,
          title: lead.title,
          text: lead.text,
          url: lead.url,
          city: lead.city,
          budget: lead.budget,
          publishedAt: lead.publishedAt,
          score: lead.score,
          createdAt: lead.createdAt,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Webhook ${response.status}: ${body.slice(0, 300)}`);
    }
  },
};
