import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";

type JobHandler = (data: unknown) => Promise<void>;

/**
 * Queue port with two adapters behind one API:
 * - REDIS_URL set → BullMQ queues + workers (production / multi-process)
 * - no REDIS_URL  → in-process execution (zero-dependency local dev)
 * Handlers are registered by feature modules at startup; `add` enqueues.
 */
@Injectable()
export class JobQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(JobQueueService.name);
  private readonly redisUrl = process.env.REDIS_URL;
  private readonly handlers = new Map<string, JobHandler>();
  private readonly queues = new Map<string, Queue>();
  private readonly workers: Worker[] = [];

  register(queueName: string, handler: JobHandler): void {
    if (this.handlers.has(queueName)) throw new Error(`Queue "${queueName}" already registered`);
    this.handlers.set(queueName, handler);
    if (this.redisUrl) {
      const worker = new Worker(queueName, async (job) => handler(job.data), {
        connection: this.connection(),
        concurrency: 2,
      });
      worker.on("failed", (job, err) => this.logger.error(`Job ${queueName}#${job?.id} failed: ${err.message}`));
      this.workers.push(worker);
      this.logger.log(`BullMQ worker started for "${queueName}"`);
    } else {
      this.logger.log(`In-process queue registered for "${queueName}" (REDIS_URL not set)`);
    }
  }

  async add(queueName: string, data: unknown): Promise<void> {
    if (this.redisUrl) {
      let queue = this.queues.get(queueName);
      if (!queue) {
        queue = new Queue(queueName, { connection: this.connection() });
        this.queues.set(queueName, queue);
      }
      await queue.add("job", data, { removeOnComplete: 200, removeOnFail: 1000, attempts: 1 });
      return;
    }
    const handler = this.handlers.get(queueName);
    if (!handler) throw new Error(`No handler registered for queue "${queueName}"`);
    setImmediate(() => {
      handler(data).catch((err: Error) => this.logger.error(`In-process job on "${queueName}" failed: ${err.message}`, err.stack));
    });
  }

  private connection(): IORedis {
    return new IORedis(this.redisUrl!, { maxRetriesPerRequest: null });
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([
      ...this.workers.map((w) => w.close()),
      ...[...this.queues.values()].map((q) => q.close()),
    ]);
  }
}
