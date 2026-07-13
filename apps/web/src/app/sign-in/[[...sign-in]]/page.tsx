"use client";

import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { TempoLogo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { clerkEnabled } from "@/lib/auth";

export default function SignInPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      <Link href="/">
        <TempoLogo />
      </Link>
      {clerkEnabled ? (
        <SignIn signUpUrl="/sign-up" fallbackRedirectUrl="/dashboard" />
      ) : (
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Local development mode</CardTitle>
            <CardDescription>
              Clerk isn&apos;t configured yet (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is empty), so
              you&apos;re signed in as a local dev user automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/dashboard">Continue to the app</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
