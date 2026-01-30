type Req = {
  method?: string;
  query?: Record<string, string | string[]>;
  headers?: Record<string, string | string[] | undefined>;
  body?: any;
};

type Res = {
  status: (code: number) => Res;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
  json?: (data: any) => void;
};

function getQueryParam(req: Req, key: string): string | undefined {
  const v = req.query?.[key];
  if (Array.isArray(v)) return v[0];
  return v as string | undefined;
}

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
  const { get } = parseCookies(req);
  const userId = get("user_id");
  const signedIn = get("signed_in") === "1";
  if (!signedIn || !userId) {
    res.setHeader("Content-Type", "application/json");
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
    res.status(500).end(JSON.stringify({ error: "server_env_missing", diagnostics }));
    return;
  }

  const { adminDb } = await import("../../lib/firebase-admin.js");
  const uid = decodeURIComponent(userId);

  if (req.method === "GET") {
    const date = getQueryParam(req, "date");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.setHeader("Content-Type", "application/json");
      res.status(400).end(JSON.stringify({ error: "invalid_date" }));
      return;
    }
    try {
      const docRef = adminDb.collection("users").doc(uid).collection("wordle").doc(date);
      const snap = await docRef.get();
      const data = snap.exists ? snap.data() : {};
      const guesses = Array.isArray(data?.guesses) ? data!.guesses : [];
      const cols = typeof data?.cols === "number" ? data!.cols : undefined;
      res.setHeader("Content-Type", "application/json");
      res.status(200).end(JSON.stringify({ guesses, cols }));
    } catch (e: any) {
      const msg = typeof e?.message === "string" ? e.message : "unknown_error";
      res.setHeader("Content-Type", "application/json");
      res.status(500).end(JSON.stringify({ error: msg }));
    }
    return;
  }

  if (req.method === "POST") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const date: string | undefined = body?.date;
      const guesses: unknown = body?.guesses;
      const cols: unknown = body?.cols;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.setHeader("Content-Type", "application/json");
        res.status(400).end(JSON.stringify({ error: "invalid_date" }));
        return;
      }
      if (!Array.isArray(guesses) || !guesses.every((g) => typeof g === "string")) {
        res.setHeader("Content-Type", "application/json");
        res.status(400).end(JSON.stringify({ error: "invalid_guesses" }));
        return;
      }
      const colsNum = typeof cols === "number" ? cols : undefined;
      const docRef = adminDb.collection("users").doc(uid).collection("wordle").doc(date);
      await docRef.set({ guesses, cols: colsNum, updatedAt: new Date().toISOString() }, { merge: true });
      res.setHeader("Content-Type", "application/json");
      res.status(200).end(JSON.stringify({ ok: true }));
    } catch (e: any) {
      const msg = typeof e?.message === "string" ? e.message : "unknown_error";
      res.setHeader("Content-Type", "application/json");
      res.status(500).end(JSON.stringify({ error: msg }));
    }
    return;
  }

  res.setHeader("Content-Type", "application/json");
  res.status(405).end(JSON.stringify({ error: "Method Not Allowed" }));
}
