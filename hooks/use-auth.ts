import {
    flushPendingConnectionsEvents,
    flushPendingConnectionsProgresses,
} from "@/lib/connections/pending";
import {
    flushPendingStrandsEvents,
    flushPendingStrandsProgresses,
} from "@/lib/strands/pending";
import {
    flushPendingWordleEvents,
    flushPendingWordleProgresses,
} from "@/lib/wordle/pending";
import { useCallback, useEffect, useState } from "react";

export function useAuth() {
  const [isClient, setIsClient] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  // Mark that we're on the client to avoid hydration mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to get auth state");
      const data = (await res.json()) as { signedIn: boolean };
      setSignedIn(data.signedIn);
    } catch {
      setSignedIn(false);
    }
  }, []);

  useEffect(() => {
    if (isClient) {
      refresh();
    }
  }, [isClient, refresh]);

  useEffect(() => {
    if (!isClient) return;
    if (!signedIn) return;
    // Best-effort flush; failures leave events queued.
    (async () => {
      await flushPendingWordleProgresses();
      await flushPendingConnectionsProgresses();
      await flushPendingStrandsProgresses();
      await flushPendingWordleEvents();
      await flushPendingConnectionsEvents();
      await flushPendingStrandsEvents();
    })().catch(() => {});
  }, [isClient, signedIn]);

  return { signedIn, refresh, isClient };
}
