"use client";

/**
 * Auth seam: Clerk when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is configured,
 * a local dev identity otherwise (paired with the API's AUTH_DEV_BYPASS).
 * The rest of the app talks only to these exports, never to Clerk directly,
 * so the two modes stay interchangeable.
 */
import { ClerkProvider, useAuth, useUser } from "@clerk/nextjs";
import type { ReactNode } from "react";

export const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!clerkEnabled) return <>{children}</>;
  return <ClerkProvider>{children}</ClerkProvider>;
}

export interface SessionInfo {
  isLoaded: boolean;
  isSignedIn: boolean;
  displayName: string;
  imageUrl: string | null;
}

function useClerkSessionInfo(): SessionInfo {
  const { isLoaded, isSignedIn, user } = useUser();
  return {
    isLoaded,
    isSignedIn: Boolean(isSignedIn),
    displayName: user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "Player",
    imageUrl: user?.imageUrl ?? null,
  };
}

function useDevSessionInfo(): SessionInfo {
  return { isLoaded: true, isSignedIn: true, displayName: "Dev User", imageUrl: null };
}

export const useSessionInfo: () => SessionInfo = clerkEnabled ? useClerkSessionInfo : useDevSessionInfo;

type TokenGetter = () => Promise<string | null>;

function useClerkToken(): TokenGetter {
  const { getToken } = useAuth();
  return getToken;
}

function useDevToken(): TokenGetter {
  return async () => null;
}

/** Returns a function producing the bearer token for API calls. */
export const useApiToken: () => TokenGetter = clerkEnabled ? useClerkToken : useDevToken;
