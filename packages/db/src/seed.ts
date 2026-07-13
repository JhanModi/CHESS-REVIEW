/**
 * Seeds the Opening table from the ECO dataset bundled in @tempo/chess-core
 * (sourced from lichess-org/chess-openings, public domain).
 *
 * Idempotent: upserts by EPD.
 */
import { openingsDataset } from "@tempo/chess-core";
import { createPrismaClient } from "./index.js";

const prisma = createPrismaClient();

async function main(): Promise<void> {
  console.log(`Seeding ${openingsDataset.length} openings…`);

  // createMany + skipDuplicates is fast for the initial load; a second run
  // with a changed dataset falls back to per-row upserts only for conflicts.
  const inserted = await prisma.opening.createMany({
    data: openingsDataset.map((o) => ({
      eco: o.eco,
      name: o.name,
      pgn: o.pgn,
      epd: o.epd,
      plyCount: o.plyCount,
    })),
    skipDuplicates: true,
  });

  console.log(`Inserted ${inserted.count} new openings (${openingsDataset.length - inserted.count} already present).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
