import { createParamDecorator, SetMetadata, type ExecutionContext } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";
/** Marks a route as reachable without authentication (share pages, health). */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

export interface RequestUser {
  /** Database user id. */
  id: string;
  clerkId: string;
}

/** Injects the authenticated user attached by ClerkAuthGuard. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestUser => {
  const request = ctx.switchToHttp().getRequest<{ user?: RequestUser }>();
  if (!request.user) throw new Error("CurrentUser used on an unauthenticated route");
  return request.user;
});
