import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Crown,
  Download,
  Gauge,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { TempoLogo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const FEATURES = [
  {
    icon: BrainCircuit,
    title: "Stockfish 18 in your browser",
    body: "Full-game engine analysis runs locally in a Web Worker — multithreaded where your browser allows, private everywhere. No queue, no server round-trips.",
  },
  {
    icon: Sparkles,
    title: "Every move, classified",
    body: "Brilliant, great, best, inaccuracy, mistake, blunder, miss — derived from the published win-probability model with thresholds you can tune.",
  },
  {
    icon: Download,
    title: "Import from anywhere",
    body: "Sync your Lichess and Chess.com games by username, drop in PGN files, or paste raw movetext. Multi-game files just work.",
  },
  {
    icon: Gauge,
    title: "Accuracy that means something",
    body: "Per-move and per-game accuracy, average centipawn loss, phase-by-phase breakdowns and turning points — computed server-side, comparable across your whole history.",
  },
  {
    icon: BarChart3,
    title: "Trends, not just games",
    body: "Win rates, accuracy over time, your most-played openings and where they score. The dashboard reads your history so you don't have to.",
  },
  {
    icon: Crown,
    title: "Opening intelligence",
    body: "3,800+ ECO lines recognised position-by-position — transpositions included — so the book/theory boundary in your games is always visible.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <TempoLogo />
        <nav className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard">
              Open the app
              <ArrowRight />
            </Link>
          </Button>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 text-center md:pt-24">
          <p className="mx-auto mb-4 w-fit rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
            Free · engine analysis runs on your machine
          </p>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold tracking-tight md:text-6xl">
            Every move, <span className="text-primary">understood.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-muted-foreground md:text-lg">
            Tempo turns your games into lessons: import from Lichess or Chess.com, analyse with
            Stockfish 18, and see exactly where the game turned — move by move, phase by phase.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/sign-in">Start analysing</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/import">Import a game</Link>
            </Button>
          </div>
        </section>

        <section className="border-t bg-card/40">
          <div className="mx-auto grid max-w-6xl gap-4 px-6 py-16 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="bg-card/70">
                <CardContent className="p-6">
                  <feature.icon className="mb-3 size-6 text-primary" />
                  <h3 className="mb-1.5 font-medium">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <TempoLogo className="text-foreground" />
          <p>
            Engine: Stockfish 18 (GPL-3.0, unmodified separate artifact). Piece art: rhosgfx (CC0).
            Opening data: lichess-org/chess-openings (public domain).
          </p>
        </div>
      </footer>
    </div>
  );
}
