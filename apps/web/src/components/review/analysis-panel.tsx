"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Cpu, Square, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { AnalysisDto, GameDetailDto } from "@tempo/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DEFAULT_ANALYSIS_DEPTH, GameAnalyser } from "@/lib/engine/game-analyser";
import { useApi } from "@/lib/use-api";

interface RunState {
  running: boolean;
  engineName: string | null;
  threads: number;
  done: number;
  total: number;
}

const IDLE: RunState = { running: false, engineName: null, threads: 1, done: 0, total: 0 };

export function AnalysisPanel({ game }: { game: GameDetailDto }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [state, setState] = useState<RunState>(IDLE);
  const analyserRef = useRef<GameAnalyser | null>(null);

  // Never leave an engine worker running after leaving the page.
  useEffect(() => () => analyserRef.current?.stop(), []);

  const applyServerAnalysis = (analysis: AnalysisDto): void => {
    queryClient.setQueryData<GameDetailDto>(["game", game.id], (old) =>
      old ? { ...old, analysis } : old,
    );
  };

  const start = (): void => {
    const analyser = new GameAnalyser(game, api, {
      onEngineReady: ({ name, threads }) =>
        setState((s) => ({ ...s, engineName: name, threads })),
      onProgress: ({ done, total }) => setState((s) => ({ ...s, done, total })),
      onServerUpdate: applyServerAnalysis,
      onComplete: (analysis) => {
        applyServerAnalysis(analysis);
        setState(IDLE);
        analyserRef.current = null;
        toast.success("Analysis complete");
      },
      onError: (error) => {
        setState(IDLE);
        analyserRef.current = null;
        toast.error(`Analysis failed: ${error.message}`);
      },
    });
    analyserRef.current = analyser;
    setState({ ...IDLE, running: true, total: game.moves.length + 1, done: game.analysis?.lastPly ?? 0 });
    void analyser.run();
  };

  const stop = (): void => {
    analyserRef.current?.stop();
    analyserRef.current = null;
    setState(IDLE);
    toast.info("Analysis paused — it will resume where it stopped.");
  };

  if (game.analysis?.status === "COMPLETE" && !state.running) {
    return (
      <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
        <Cpu className="size-3.5" />
        Analysed with {game.analysis.engineId} · depth {game.analysis.targetDepth}
      </p>
    );
  }

  if (!state.running) {
    const resuming = (game.analysis?.lastPly ?? 0) > 0;
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-medium">
              {resuming ? "Analysis incomplete" : "Not analysed yet"}
            </p>
            <p className="text-xs text-muted-foreground">
              Stockfish 18 runs locally in your browser · depth {DEFAULT_ANALYSIS_DEPTH}
            </p>
          </div>
          <Button onClick={start}>
            <Zap />
            {resuming ? "Resume analysis" : "Analyse game"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const pct = state.total > 0 ? (state.done / state.total) * 100 : 0;
  return (
    <Card>
      <CardContent className="space-y-2.5 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">
            Analysing… {state.done}/{state.total} positions
          </p>
          <Button variant="ghost" size="sm" onClick={stop}>
            <Square className="size-3.5" /> Stop
          </Button>
        </div>
        <Progress value={pct} />
        <p className="text-xs text-muted-foreground">
          {state.engineName ?? "Starting engine…"}
          {state.engineName ? ` · ${state.threads} thread${state.threads > 1 ? "s" : ""}` : ""}
        </p>
      </CardContent>
    </Card>
  );
}
