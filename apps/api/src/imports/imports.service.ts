import { Injectable, Logger, NotFoundException, type OnModuleInit } from "@nestjs/common";
import type { GameSource, ImportJob } from "@tempo/db";
import type { ImportJobDto, ImportRequest } from "@tempo/types";
import { GamesService } from "../games/games.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { JobQueueService } from "../queue/job-queue.service.js";
import { ChesscomClient, LichessClient, PlatformError } from "./platform-clients.js";

const IMPORTS_QUEUE = "imports";

interface ImportJobPayload {
  jobId: string;
}

function toDto(job: ImportJob): ImportJobDto {
  return {
    id: job.id,
    source: job.source,
    username: job.username,
    status: job.status,
    totalGames: job.totalGames,
    gamesImported: job.gamesImported,
    gamesSkipped: job.gamesSkipped,
    error: job.error,
    createdAt: job.createdAt.toISOString(),
  };
}

@Injectable()
export class ImportsService implements OnModuleInit {
  private readonly logger = new Logger(ImportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: JobQueueService,
    private readonly games: GamesService,
    private readonly lichess: LichessClient,
    private readonly chesscom: ChesscomClient,
  ) {}

  onModuleInit(): void {
    this.queue.register(IMPORTS_QUEUE, (data) => this.process(data as ImportJobPayload));
  }

  async enqueue(userId: string, source: "LICHESS" | "CHESSCOM", dto: ImportRequest): Promise<ImportJobDto> {
    const job = await this.prisma.importJob.create({
      data: { userId, source, username: dto.username, cursor: String(dto.max) },
    });
    await this.queue.add(IMPORTS_QUEUE, { jobId: job.id } satisfies ImportJobPayload);
    return toDto(job);
  }

  async get(userId: string, jobId: string): Promise<ImportJobDto> {
    const job = await this.prisma.importJob.findFirst({ where: { id: jobId, userId } });
    if (!job) throw new NotFoundException("Import job not found");
    return toDto(job);
  }

  async listRecent(userId: string): Promise<ImportJobDto[]> {
    const jobs = await this.prisma.importJob.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    return jobs.map(toDto);
  }

  /** Queue worker: fetch from the platform and persist games idempotently. */
  private async process({ jobId }: ImportJobPayload): Promise<void> {
    const job = await this.prisma.importJob.findUnique({ where: { id: jobId } });
    if (!job) return;
    await this.prisma.importJob.update({ where: { id: jobId }, data: { status: "RUNNING" } });

    try {
      const max = Math.min(Number(job.cursor) || 10, 200);
      const client = job.source === "LICHESS" ? this.lichess : this.chesscom;
      const fetched = await client.fetchRecentGames(job.username, max);
      await this.prisma.importJob.update({
        where: { id: jobId },
        data: { totalGames: fetched.length },
      });

      let imported = 0;
      let skipped = 0;
      for (const [index, game] of fetched.entries()) {
        const id = await this.games.createFromImport(
          job.userId,
          { ...game, source: job.source as GameSource },
          job.username,
        );
        if (id) imported++;
        else skipped++;
        if ((index + 1) % 10 === 0) {
          await this.prisma.importJob.update({
            where: { id: jobId },
            data: { gamesImported: imported, gamesSkipped: skipped },
          });
        }
      }

      await this.prisma.importJob.update({
        where: { id: jobId },
        data: { status: "COMPLETED", gamesImported: imported, gamesSkipped: skipped },
      });
      this.logger.log(`Import ${jobId} (${job.source}/${job.username}): ${imported} new, ${skipped} skipped`);
    } catch (err) {
      const message =
        err instanceof PlatformError ? err.message : `Import failed: ${(err as Error).message}`;
      this.logger.error(`Import ${jobId} failed: ${message}`);
      await this.prisma.importJob.update({
        where: { id: jobId },
        data: { status: "FAILED", error: message },
      });
    }
  }
}
