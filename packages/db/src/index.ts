export * from "../generated/client/index.js";
import { PrismaClient } from "../generated/client/index.js";

export type PrismaClientOptions = ConstructorParameters<typeof PrismaClient>[0];

export function createPrismaClient(options?: PrismaClientOptions): PrismaClient {
  return new PrismaClient(options);
}
