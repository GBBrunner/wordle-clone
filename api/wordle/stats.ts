// Vercel Serverless Function: Return Wordle stats for the current user
// Reads Firestore document fields and computes summary values.

type Req = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type Res = {
  status: (code: number) => Res;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
  json?: (data: any) => void;
};

function parseCookies(req: Req) {
  const cookieHeader = (req.headers?.["cookie"] || req.headers?.["Cookie"]) as
    | string
    | undefined;
  const get = (name: string) => {
    return (
      cookieHeader
        ?.split(/;\s*/)
        .find((c: string) => c.startsWith(name + "="))
        ?.split("=")[1] || null
    );
  };
  return { cookieHeader, get };
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "GET") {
    res.status(405).end(JSON.stringify({ error: "Method Not Allowed" }));
    return;
  }

  const { get } = parseCookies(req);
  const userId = get("user_id");
  const signedIn = get("signed_in") === "1";

  if (!signedIn || !userId) {
    res.status(401).end(JSON.stringify({ error: "unauthorized" }));
    return;
  }

  const diagnostics = {
    hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
    hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
    hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
  };

  if (!diagnostics.hasProjectId || !diagnostics.hasClientEmail || !diagnostics.hasPrivateKey) {
    res.setHeader("Content-Type", "application/json");
    res
      .status(500)
      .end(JSON.stringify({ error: "server_env_missing", diagnostics }));
    return;
  }

  try {
    const { adminDb } = await import("../../lib/firebase-admin.js");
    const snap = await adminDb
      .collection("users")
      .doc(decodeURIComponent(userId))
      .get();

    const data = (snap.exists ? snap.data() : {}) as Record<string, any>;
    const games_played = Number(data?.games_played || 0);
    const wordles_completed = Number(data?.wordles_completed || 0);
    const distribution: Record<string, number> = {};
    for (let i = 1; i <= 10; i++) {
      const k = `wordle_in_${i}`;
      const v = Number(data?.[k] || 0);
      if (v > 0) distribution[k] = v;
      else distribution[k] = 0;
    }

    const winRate = games_played > 0 ? Math.round((wordles_completed / games_played) * 100) : 0;

    res.setHeader("Content-Type", "application/json");
    res.status(200).end(
      JSON.stringify({ games_played, wordles_completed, winRate, distribution }),
    );
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "unknown_error";
    res.setHeader("Content-Type", "application/json");
    res.status(500).end(JSON.stringify({ error: msg }));
  }
}
