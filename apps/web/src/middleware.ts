import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/games(.*)", "/import(.*)", "/settings(.*)"]);

// Clerk unconfigured → run without auth (local dev pairs with the API's
// AUTH_DEV_BYPASS). Configured → protect the app routes.
const middleware = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  ? clerkMiddleware(async (auth, req) => {
      if (isProtectedRoute(req)) await auth.protect();
    })
  : () => NextResponse.next();

export default middleware;

export const config = {
  matcher: [
    "/((?!_next|stockfish|pieces|.*\\.(?:svg|png|jpg|ico|css|js|wasm|nnue)$).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
