"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ImportJobDto } from "@tempo/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

function PgnImportCard() {
  const api = useApi();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pgn, setPgn] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: (payload: { pgn: string; source: "UPLOAD" | "PASTE" }) =>
      api<{ ids: string[]; count: number }>("/games", { method: "POST", body: payload }),
    onSuccess: async ({ ids, count }) => {
      await queryClient.invalidateQueries({ queryKey: ["games"] });
      toast.success(`Imported ${count} game${count > 1 ? "s" : ""}`);
      setPgn("");
      if (count === 1) router.push(`/games/${ids[0]}`);
      else router.push("/games");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const readFile = useCallback(
    (file: File) => {
      if (file.size > 2_000_000) {
        toast.error("PGN file too large (max 2 MB)");
        return;
      }
      void file.text().then((text) => upload.mutate({ pgn: text, source: "UPLOAD" }));
    },
    [upload],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>PGN</CardTitle>
        <CardDescription>Paste a game (or several), or drop a .pgn file.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          className={cn(
            "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
          )}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) readFile(file);
          }}
        >
          <Upload className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a .pgn file here or click to browse</p>
          <p className="text-xs text-muted-foreground">Multi-game files supported (up to 100 games)</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pgn,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) readFile(file);
              e.target.value = "";
            }}
          />
        </div>

        <textarea
          value={pgn}
          onChange={(e) => setPgn(e.target.value)}
          placeholder={'1. e4 e5 2. Nf3 Nc6 3. Bb5 …\n\nor a full PGN with headers'}
          rows={6}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button
          className="w-full"
          disabled={pgn.trim().length < 4 || upload.isPending}
          onClick={() => upload.mutate({ pgn, source: "PASTE" })}
        >
          {upload.isPending ? <Loader2 className="animate-spin" /> : <FileText />}
          Import PGN
        </Button>
      </CardContent>
    </Card>
  );
}

function PlatformSyncCard({
  platform,
  title,
  description,
}: {
  platform: "lichess" | "chesscom";
  title: string;
  description: string;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);

  const { data: job } = useQuery({
    queryKey: ["import-job", jobId],
    queryFn: () => api<ImportJobDto>(`/imports/${jobId}`),
    enabled: jobId !== null,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status === "COMPLETED" || status === "FAILED" ? false : 1200;
    },
  });

  const start = useMutation({
    mutationFn: () =>
      api<ImportJobDto>(`/imports/${platform}`, { method: "POST", body: { username: username.trim(), max: 50 } }),
    onSuccess: (created) => setJobId(created.id),
    onError: (error: Error) => toast.error(error.message),
  });

  const done = job?.status === "COMPLETED";
  const failed = job?.status === "FAILED";
  const running = jobId !== null && !done && !failed;

  useEffect(() => {
    if (done) void queryClient.invalidateQueries({ queryKey: ["games"] });
  }, [done, queryClient]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (username.trim().length >= 2) start.mutate();
          }}
        >
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            disabled={running}
          />
          <Button type="submit" disabled={username.trim().length < 2 || running || start.isPending}>
            {running || start.isPending ? <Loader2 className="animate-spin" /> : "Sync"}
          </Button>
        </form>

        {job && (
          <div className="space-y-1.5 rounded-md border p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{job.username}</span>
              <Badge variant={failed ? "destructive" : done ? "secondary" : "outline"}>
                {job.status.toLowerCase()}
              </Badge>
            </div>
            {job.totalGames !== null && job.totalGames > 0 && (
              <Progress value={((job.gamesImported + job.gamesSkipped) / job.totalGames) * 100} />
            )}
            <p className="text-xs text-muted-foreground">
              {failed
                ? job.error
                : `${job.gamesImported} imported${job.gamesSkipped > 0 ? `, ${job.gamesSkipped} already known` : ""}${job.totalGames !== null ? ` of ${job.totalGames} fetched` : ""}`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ImportPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-xl font-semibold">Import games</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <PgnImportCard />
        <div className="space-y-4">
          <PlatformSyncCard
            platform="lichess"
            title="Lichess"
            description="Fetches your 50 most recent standard games (no account linking needed)."
          />
          <PlatformSyncCard
            platform="chesscom"
            title="Chess.com"
            description="Fetches your 50 most recent games from the monthly archives."
          />
        </div>
      </div>
    </div>
  );
}
