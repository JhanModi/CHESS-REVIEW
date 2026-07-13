import {
  Injectable,
  Logger,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { createClerkClient, verifyToken } from "@clerk/backend";
import type { Request } from "express";
import { IS_PUBLIC_KEY, type RequestUser } from "../common/decorators.js";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * Verifies Clerk session JWTs on every non-public route and attaches the
 * database user to the request. Verification is networkless when
 * CLERK_JWT_KEY (the instance's PEM public key) is configured; otherwise
 * @clerk/backend falls back to fetching + caching the instance JWKS.
 */
@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const secretKey = this.config.get<string>("CLERK_SECRET_KEY");

    // Explicit local-development escape hatch: only when Clerk is not
    // configured at all AND the bypass is opted into. Never in production.
    if (!secretKey) {
      if (process.env.NODE_ENV !== "production" && this.config.get("AUTH_DEV_BYPASS") === "true") {
        request.user = await this.devUser();
        return true;
      }
      throw new UnauthorizedException("Authentication is not configured");
    }

    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) throw new UnauthorizedException("Missing bearer token");

    let clerkId: string;
    try {
      const jwtKey = this.config.get<string>("CLERK_JWT_KEY") || undefined;
      const payload = await verifyToken(token, { secretKey, jwtKey });
      clerkId = payload.sub;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }

    const existing = await this.prisma.user.findUnique({ where: { clerkId }, select: { id: true } });
    const userId = existing?.id ?? (await this.provisionUser(clerkId, secretKey)).id;
    request.user = { id: userId, clerkId };
    return true;
  }

  /** First request from this Clerk account: pull profile data once, persist. */
  private async provisionUser(clerkId: string, secretKey: string): Promise<{ id: string }> {
    let email = `${clerkId}@users.tempo.local`;
    let displayName: string | null = null;
    try {
      const clerk = createClerkClient({ secretKey });
      const clerkUser = await clerk.users.getUser(clerkId);
      email =
        clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress ?? email;
      displayName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;
    } catch (err) {
      this.logger.warn(`Could not fetch Clerk profile for ${clerkId}: ${(err as Error).message}`);
    }
    return this.prisma.user.upsert({
      where: { clerkId },
      create: { clerkId, email, displayName },
      update: {},
      select: { id: true },
    });
  }

  private async devUser(): Promise<RequestUser> {
    const user = await this.prisma.user.upsert({
      where: { clerkId: "dev-user" },
      create: { clerkId: "dev-user", email: "dev@tempo.local", displayName: "Dev User" },
      update: {},
      select: { id: true },
    });
    return { id: user.id, clerkId: "dev-user" };
  }
}
