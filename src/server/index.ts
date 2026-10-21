import { serve } from '@hono/node-server';
import type { Hono } from 'hono';

export function startServer(app: Hono, port: number): ReturnType<typeof serve> {
  return serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      console.log(`Radar is listening on http://127.0.0.1:${info.port}`);
    },
  );
}
