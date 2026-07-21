"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Swords, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import type { GameListItemDto, PagedDto } from "@tempo/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

const RESULT_LABEL: Record<string, string> = {
  WHITE_WIN: "1–0",
  BLACK_WIN: "0–1",
  DRAW: "½–½",
  UNKNOWN: "·",
};

const SOURCE_FILTERS = [
  { value: undefined, label: "All" },
  { value: "LICHESS", label: "Lichess" },
  { value: "CHESSCOM", label: "Chess.com" },
  { value: "UPLOAD", label: "Uploads" },
  { value: "PASTE", label: "Pasted" },
] as const;

function resultTone(game: GameListItemDto): string {
  if (!game.userColor || game.result === "UNKNOWN") return "text-muted-foreground";
  if (game.result === "DRAW") return "text-muted-foreground";
  const won = (game.result === "WHITE_WIN") === (game.userColor === "WHITE");
  return won ? "text-[var(--cls-best)]" : "text-[var(--cls-blunder)]";
}

/** Per-game delete: a confirmation dialog so imported/other-players' games can
 *  be removed without polluting personal stats. */
function DeleteGameButton({ game }: { game: GameListItemDto }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const del = useMutation({
    mutationFn: () => api(`/games/${game.id}`, { method: "DELETE" }),
    onSuccess: async () => {
      setOpen(false);
      toast.success("Game deleted");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["games"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
    onError: () => toast.error("Could not delete the game"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete game"
          className="shrink-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2 />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this game?</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">
              {game.whiteName} vs {game.blackName}
            </span>{" "}
            and its analysis will be permanently removed from your account. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant="destructive" onClick={() => del.mutate()} disabled={del.isPending}>
            {del.isPending ? "Deleting…" : "Delete game"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function GamesPage() {
  const api = useApi();
  const [source, setSource] = useState<string | undefined>(undefined);

  const query = useInfiniteQuery({
    queryKey: ["games", source],
    queryFn: ({ pageParam }) =>
      api<PagedDto<GameListItemDto>>(
        `/games?limit=25${source ? `&source=${source}` : ""}${pageParam ? `&cursor=${pageParam}` : ""}`,
      ),
    initialPageParam: "",
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const games = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Your games</h1>
        <Button asChild size="sm">
          <Link href="/import">
            <Download /> Import games
          </Link>
        </Button>
      </div>

      <div className="flex gap-1.5">
        {SOURCE_FILTERS.map((f) => (
          <Button
            key={f.label}
            size="sm"
            variant={source === f.value ? "secondary" : "ghost"}
            onClick={() => setSource(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {query.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : games.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Swords className="size-8 text-muted-foreground" />
            <p className="font-medium">No games yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Import your games from Lichess or Chess.com, or paste a PGN to get your first
              analysis.
            </p>
            <Button asChild>
              <Link href="/import">Import games</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {games.map((game) => (
            <div
              key={game.id}
              className="flex items-center gap-2 rounded-lg border bg-card pr-2 transition-colors hover:bg-accent/50"
            >
              <Link
                href={`/games/${game.id}`}
                className="flex min-w-0 flex-1 items-center gap-4 px-4 py-3"
              >
                <span className={cn("w-8 text-center font-mono text-sm font-bold", resultTone(game))}>
                  {RESULT_LABEL[game.result]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {game.whiteName} vs {game.blackName}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {game.openingName ?? "Unknown opening"}
                    {game.playedAt ? ` · ${new Date(game.playedAt).toLocaleDateString()}` : ""}
                  </span>
                </span>
                {game.userAccuracy !== null && (
                  <span className="text-sm font-semibold tabular-nums">{game.userAccuracy.toFixed(1)}%</span>
                )}
                {game.analysisStatus === "COMPLETE" ? (
                  <Badge variant="secondary">analysed</Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    new
                  </Badge>
                )}
              </Link>
              <DeleteGameButton game={game} />
            </div>
          ))}
          {query.hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
                {query.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
