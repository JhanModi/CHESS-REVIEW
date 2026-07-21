"use client";

import { UserButton } from "@clerk/nextjs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { ClearGamesResultDto } from "@tempo/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { clerkEnabled, useSessionInfo } from "@/lib/auth";
import { useApi } from "@/lib/use-api";

/** Danger-zone confirmation: wipes every game (and its analysis) in the account. */
function ClearDataDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const api = useApi();
  const queryClient = useQueryClient();

  const clear = useMutation({
    mutationFn: () => api<ClearGamesResultDto>("/games", { method: "DELETE" }),
    onSuccess: async ({ deleted }) => {
      onOpenChange(false);
      toast.success(
        deleted > 0
          ? `Cleared ${deleted} game${deleted === 1 ? "" : "s"} from your account`
          : "You had no games to clear",
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["games"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
    onError: () => toast.error("Could not clear your chess data"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clear all chess data?</DialogTitle>
          <DialogDescription>
            This permanently deletes <span className="font-medium text-foreground">every game</span> in
            your account — including any you imported for review — along with all of their analysis. Your
            dashboard stats reset to empty. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant="destructive" onClick={() => clear.mutate()} disabled={clear.isPending}>
            {clear.isPending ? "Clearing…" : "Clear all data"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The account control in the app header. With Clerk, it's the standard
 * `UserButton` (Manage account / Sign out) plus a custom "Clear chess data"
 * action in the same dropdown. Without Clerk (local dev) it's the identity
 * avatar, clickable to reach the same danger-zone dialog.
 */
export function AccountMenu() {
  const session = useSessionInfo();
  const [clearOpen, setClearOpen] = useState(false);

  return (
    <>
      {clerkEnabled ? (
        <UserButton>
          <UserButton.MenuItems>
            <UserButton.Action
              label="Clear chess data"
              labelIcon={<Trash2 className="size-4" />}
              onClick={() => setClearOpen(true)}
            />
          </UserButton.MenuItems>
        </UserButton>
      ) : (
        <button
          type="button"
          onClick={() => setClearOpen(true)}
          className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
          title={`${session.displayName} (local dev) — click to clear chess data`}
        >
          {session.displayName.slice(0, 1)}
        </button>
      )}
      <ClearDataDialog open={clearOpen} onOpenChange={setClearOpen} />
    </>
  );
}
