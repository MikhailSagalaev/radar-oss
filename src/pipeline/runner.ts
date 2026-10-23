import type { Logger } from '../core/types.ts';
import { pollAll, type PollDeps } from './poll.ts';
import { processOutbox } from './outbox.ts';

export class PollRunner {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly deps: PollDeps,
    private readonly intervalSec: number,
    private readonly logger: Logger,
  ) {}

  start(): void {
    const tick = (): void => {
      if (this.running) {
        this.logger.debug('poll tick skipped: previous run is still active');
        return;
      }
      this.running = true;
      void (async () => {
        try {
          const summaries = await pollAll(this.deps);
          if (summaries.length) {
            this.logger.info('scheduled poll finished', {
              sources: summaries.length,
              delivered: summaries.reduce((sum, item) => sum + item.delivered, 0),
              errors: summaries.filter((item) => item.error).length,
            });
          }

          // Запуск обработки отложенной Outbox-доставки
          const outboxRes = await processOutbox({
            store: this.deps.store,
            sinks: this.deps.sinks,
            env: this.deps.env,
            logger: this.deps.logger,
            fetchImpl: this.deps.fetchImpl,
          });
          if (outboxRes.processed > 0) {
            this.logger.info('outbox delivery batch finished', outboxRes);
          }
        } catch (error) {
          this.logger.error('scheduled cycle failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        } finally {
          this.running = false;
        }
      })();
    };

    tick();
    this.timer = setInterval(tick, Math.max(10, this.intervalSec) * 1000);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}
