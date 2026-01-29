// Vercel Serverless Function: Record a Wordle win for the current user
// Increments Firestore counters: wordles_completed and wordle_in_{guessCount}
// Reads HttpOnly cookie 'user_id' set during Google OAuth callback

type Req = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: any;
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
  if (req.method !== "POST") {
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

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const guessCount = Number(body?.guessCount);
    if (!Number.isFinite(guessCount) || guessCount < 1 || guessCount > 10) {
      res.status(400).end(JSON.stringify({ error: "invalid_guessCount" }));
      return;
    }

    const { adminDb, admin } = await import("../../lib/firebase-admin.js");
    const userRef = adminDb.collection("users").doc(decodeURIComponent(userId));

    await userRef.set(
      {
        wordles_completed: (admin.firestore as any).FieldValue.increment(1),
        ["wordle_in_" + guessCount]: (
          admin.firestore as any
        ).FieldValue.increment(1),
      },
      { merge: true },
    );

    // If FieldValue.increment is not available via adminDb, fallback to a transaction
    // Note: In typical Firebase Admin SDK, use admin.firestore.FieldValue.increment
    // The above cast handles module import differences.

    res.setHeader("Content-Type", "application/json");
    res.status(200).end(JSON.stringify({ ok: true }));
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "unknown_error";
    res.status(500).end(JSON.stringify({ error: msg }));
  }
}
