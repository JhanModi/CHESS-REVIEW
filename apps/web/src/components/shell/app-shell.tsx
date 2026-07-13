"use client";

import { BarChart3, Download, Moon, Sun, Swords } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import { TempoLogo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { clerkEnabled, useSessionInfo } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { UserButton } from "@clerk/nextjs";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/games", label: "Games", icon: Swords },
  { href: "/import", label: "Import", icon: Download },
] as const;

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  );
}

function SessionBadge() {
  const session = useSessionInfo();
  if (clerkEnabled) return <UserButton />;
  return (
    <div
      className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
      title={`${session.displayName} (local dev)`}
    >
      {session.displayName.slice(0, 1)}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-56 shrink-0 flex-col border-r bg-card/50 md:flex">
        <div className="px-5 py-5">
          <Link href="/">
            <TempoLogo />
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-4 text-[11px] leading-relaxed text-muted-foreground">
          Engine analysis runs locally in your browser.
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b px-4 md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <Link href="/">
              <TempoLogo />
            </Link>
          </div>
          <nav className="hidden gap-1 md:flex" aria-hidden />
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <SessionBadge />
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-6">{children}</main>
        <nav className="sticky bottom-0 flex border-t bg-card/95 backdrop-blur md:hidden">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
