import { useEffect, useState, useCallback } from "react";

export function useAuth() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

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
    refresh();
  }, [refresh]);

  return { signedIn, refresh };
}
