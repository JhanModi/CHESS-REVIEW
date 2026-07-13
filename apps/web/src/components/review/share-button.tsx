"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Link2, Link2Off } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { GameDetailDto } from "@tempo/types";
import { Button } from "@/components/ui/button";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

export function ShareButton({ game, className }: { game: GameDetailDto; className?: string }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const setSlug = (shareSlug: string | null): void => {
    queryClient.setQueryData<GameDetailDto>(["game", game.id], (old) =>
      old ? { ...old, shareSlug } : old,
    );
  };

  const copyLink = async (slug: string): Promise<void> => {
    await navigator.clipboard.writeText(`${window.location.origin}/share/${slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Share link copied to clipboard");
  };

  const share = useMutation({
    mutationFn: () => api<{ shareSlug: string }>(`/games/${game.id}/share`, { method: "POST" }),
    onSuccess: async ({ shareSlug }) => {
      setSlug(shareSlug);
      await copyLink(shareSlug);
    },
    onError: () => toast.error("Could not create a share link"),
  });

  const revoke = useMutation({
    mutationFn: () => api(`/games/${game.id}/share`, { method: "DELETE" }),
    onSuccess: () => {
      setSlug(null);
      toast.info("Share link revoked");
    },
  });

  if (game.shareSlug) {
    return (
      <span className={cn("flex items-center gap-1", className)}>
        <Button variant="outline" size="sm" onClick={() => copyLink(game.shareSlug!)}>
          {copied ? <Check /> : <Link2 />} Copy link
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => revoke.mutate()}
          disabled={revoke.isPending}
          aria-label="Revoke share link"
        >
          <Link2Off />
        </Button>
      </span>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={() => share.mutate()}
      disabled={share.isPending}
    >
      <Link2 /> Share
    </Button>
  );
}
