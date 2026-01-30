// Single Vercel Serverless Function router.
// This avoids the Hobby-plan limit of 12 functions by dispatching all /api/*
// requests through one function.

type Req = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
  body?: any;
  url?: string;
};

type Res = {
  status: (code: number) => Res;
  setHeader: (name: string, value: any) => void;
  end: (body?: any) => void;
  json?: (data: any) => void;
};

function getHeader(req: Req, name: string): string | undefined {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}

function setJson(res: Res, code: number, data: any) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(code).end(JSON.stringify(data));
}

function getQueryParam(req: Req, key: string): string | undefined {
  const v = req.query?.[key];
  if (Array.isArray(v)) return v[0];
  return v;
}

function parseCookies(req: Req) {
  const cookieHeader = getHeader(req, "cookie");
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

function envDiagnostics() {
  return {
    hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
    hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
    hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
  };
}

function requireFirebaseEnv(res: Res): boolean {
  const diagnostics = envDiagnostics();
  if (!diagnostics.hasProjectId || !diagnostics.hasClientEmail || !diagnostics.hasPrivateKey) {
    setJson(res, 500, { error: "server_env_missing", diagnostics });
    return false;
  }
  return true;
}

function isValidDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function setCors(res: Res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function getPathSegments(req: Req): string[] {
  // Prefer the rewrite-provided query param (from vercel.json): /api?path=...
  const rawPath = getQueryParam(req, "path") || "";
  const cleaned = rawPath.replace(/^\/+|\/+$/g, "");
  if (!cleaned) return [];
  return cleaned.split("/").filter(Boolean);
}

async function readJsonBody(req: Req): Promise<any> {
  if (req.body == null) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

// ---------------- Auth routes ----------------

async function authMe(req: Req, res: Res) {
  if (req.method !== "GET") return setJson(res, 405, { error: "Method Not Allowed" });

  const { cookieHeader } = parseCookies(req);
  const signedIn = Boolean(
    cookieHeader
      ?.split(/;\s*/)
      .find((c: string) => c.startsWith("signed_in="))
      ?.split("=")[1] === "1",
  );

  setJson(res, 200, { signedIn });
}

async function authProfile(req: Req, res: Res) {
  if (req.method !== "GET") return setJson(res, 405, { error: "Method Not Allowed" });

  const cookieHeader = getHeader(req, "cookie");
  const getCookie = (name: string) => {
    return (
      cookieHeader
        ?.split(/;\s*/)
        .find((c: string) => c.startsWith(name + "="))
        ?.split("=")[1] || null
    );
  };

  const signedIn =
    (cookieHeader
      ?.split(/;\s*/)
      .find((c: string) => c.startsWith("signed_in="))
      ?.split("=")[1] || "") === "1";

  const name = getCookie("display_name");
  const joined = getCookie("joined");

  setJson(res, 200, {
    signedIn,
    name: name ? decodeURIComponent(name) : null,
    joined: joined ? decodeURIComponent(joined) : null,
  });
}

async function authSignout(_req: Req, res: Res) {
  // Clear cookies by expiring them
  res.setHeader("Set-Cookie", [
    `signed_in=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`,
    // clear readable variants
    `signed_in=; Path=/; SameSite=Lax; Secure; Max-Age=0`,
    `display_name=; Path=/; SameSite=Lax; Secure; Max-Age=0`,
    `joined=; Path=/; SameSite=Lax; Secure; Max-Age=0`,
    `user_id=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`,
    `oauth_state=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`,
  ]);
  res.status(302).setHeader("Location", "/");
  res.end();
}

async function authCallbackGoogle(req: Req, res: Res) {
  // Diagnostic version - identifies Firebase issue
  const diagnostics = {
    ...envDiagnostics(),
    privateKeyStart: process.env.FIREBASE_PRIVATE_KEY?.substring(0, 30) || "missing",
  };

  if (getQueryParam(req, "test") === "1") {
    res.status(200).json?.({
      message: "Firebase diagnostics",
      diagnostics,
      nodeVersion: process.version,
    });
    return;
  }

  if (req.method !== "GET") return setJson(res, 405, { error: "Method Not Allowed" });

  const code = getQueryParam(req, "code");
  const state = getQueryParam(req, "state");
  const error = getQueryParam(req, "error");

  if (error) {
    res.status(302).setHeader("Location", `/login?error=${encodeURIComponent(error)}`);
    res.end();
    return;
  }

  if (!code) return setJson(res, 400, { error: "missing_code" });

  const { cookieHeader } = parseCookies(req);
  const cookieState = cookieHeader
    ?.split(/;\s*/)
    .find((c: string) => c.startsWith("oauth_state="))
    ?.split("=")[1];

  if (!state || !cookieState || state !== cookieState) {
    res
      .status(302)
      .setHeader("Location", `/login?error=${encodeURIComponent("invalid_state")}`);
    res.end();
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  let redirectUri = process.env.GOOGLE_REDIRECT_URI || process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI;

  if (!redirectUri) {
    const host = (getHeader(req, "x-forwarded-host") || getHeader(req, "host")) as string;
    const proto = (getHeader(req, "x-forwarded-proto") || "https") as string;
    redirectUri = `${proto}://${host}/api/auth/callback/google`;
  }

  if (!clientId || !clientSecret || !redirectUri) {
    return setJson(res, 500, { error: "server_env_missing" });
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenRes.ok) {
      res
        .status(302)
        .setHeader("Location", `/login?error=${encodeURIComponent("token_exchange_failed")}`);
      res.end();
      return;
    }

    const tokens = await tokenRes.json();
    const accessToken = tokens.access_token as string | undefined;

    let profile: any = null;
    if (accessToken) {
      const profRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (profRes.ok) {
        profile = await profRes.json();

        // Try Firebase with detailed error reporting
        if (profile.sub) {
          try {
            const { adminDb } = await import("../lib/firebase-admin.js");
            await adminDb.collection("users").doc(profile.sub).set(
              {
                email: profile.email,
                name: profile.name,
                picture: profile.picture,
                lastLogin: new Date().toISOString(),
              },
              { merge: true },
            );
          } catch (firebaseError: any) {
            // Continue auth flow despite Firebase error
            console.error("Firebase error details:", {
              message: firebaseError.message,
              code: firebaseError.code,
              stack: firebaseError.stack?.substring(0, 200),
              diagnostics,
            });
          }
        }
      }
    }

    const cookies: string[] = [];
    const oneWeek = 60 * 60 * 24 * 7;

    cookies.push(`signed_in=1; Path=/; HttpOnly; Max-Age=${oneWeek}`);
    if (profile?.sub) {
      const userId = encodeURIComponent(profile.sub);
      cookies.push(`user_id=${userId}; Path=/; HttpOnly; Max-Age=${oneWeek}`);
    }

    const display = encodeURIComponent(profile?.name || profile?.email || "User");
    cookies.push(`display_name=${display}; Path=/; Max-Age=${oneWeek}`);

    const hasJoined = (cookieHeader || "")
      .split(/;\s*/)
      .some((c: string) => c.startsWith("joined="));
    if (!hasJoined) {
      const joined = encodeURIComponent(new Date().toISOString());
      cookies.push(`joined=${joined}; Path=/; Max-Age=${oneWeek}`);
    }

    res.setHeader("Set-Cookie", cookies);
    res.status(302).setHeader("Location", `/`);
    res.end();
  } catch (e: any) {
    console.error("OAuth error:", e?.message);
    res
      .status(302)
      .setHeader("Location", `/login?error=${encodeURIComponent("unexpected_error")}`);
    res.end();
  }
}

// ---------------- Connections routes ----------------

function isValidConnectionsUpstreamPayload(data: any): boolean {
  if (!data || typeof data !== "object") return false;
  if (!Array.isArray(data.categories) || data.categories.length !== 4) return false;

  for (const cat of data.categories) {
    if (!cat || typeof cat !== "object") return false;
    if (typeof cat.title !== "string") return false;
    if (!Array.isArray(cat.cards) || cat.cards.length !== 4) return false;
    for (const card of cat.cards) {
      if (!card || typeof card !== "object") return false;
      if (typeof card.content !== "string") return false;
      if (typeof card.position !== "number") return false;
    }
  }
  return true;
}

async function connectionsPuzzle(req: Req, res: Res, dateFromPath?: string) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") return setJson(res, 405, { error: "Method Not Allowed" });

  const date = dateFromPath || getQueryParam(req, "date");
  if (!date || !isValidDate(date)) {
    return setJson(res, 400, { error: "Invalid date; expected YYYY-MM-DD" });
  }

  const nytUrl = `https://www.nytimes.com/svc/connections/v2/${date}.json`;

  try {
    const upstream = await fetch(nytUrl, {
      headers: {
        "User-Agent": "wordle-clone/1.0",
        Accept: "application/json",
      },
    });

    if (!upstream.ok) {
      return setJson(res, upstream.status, { error: "Upstream error", status: upstream.status });
    }

    const data = await upstream.json();
    if (!isValidConnectionsUpstreamPayload(data)) {
      return setJson(res, 502, { error: "Invalid upstream payload" });
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).end(JSON.stringify(data));
  } catch {
    setJson(res, 502, { error: "Failed to fetch upstream" });
  }
}

function isSolvedArray(v: unknown): v is number[] {
  return (
    Array.isArray(v) &&
    v.every((x) => Number.isFinite(x) && Number.isInteger(x) && x >= 0 && x <= 3)
  );
}

async function connectionsProgress(req: Req, res: Res) {
  const { get } = parseCookies(req);
  const userId = get("user_id");
  const signedIn = get("signed_in") === "1";
  if (!signedIn || !userId) return setJson(res, 401, { error: "unauthorized" });
  if (!requireFirebaseEnv(res)) return;

  const { adminDb } = await import("../lib/firebase-admin.js");
  const uid = decodeURIComponent(userId);

  if (req.method === "GET") {
    const date = getQueryParam(req, "date");
    if (!date || !isValidDate(date)) return setJson(res, 400, { error: "invalid_date" });

    try {
      const docRef = adminDb.collection("users").doc(uid).collection("connections").doc(date);
      const snap = await docRef.get();
      const data = snap.exists ? snap.data() : {};

      const mistakesLeft = typeof data?.mistakesLeft === "number" ? data!.mistakesLeft : 4;
      const solvedCategoryIndexes = isSolvedArray(data?.solvedCategoryIndexes)
        ? (data!.solvedCategoryIndexes as number[])
        : [];

      setJson(res, 200, { mistakesLeft, solvedCategoryIndexes });
    } catch (e: any) {
      setJson(res, 500, { error: typeof e?.message === "string" ? e.message : "unknown_error" });
    }
    return;
  }

  if (req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const date: string | undefined = body?.date;
      const mistakesLeft = body?.mistakesLeft;
      const solvedCategoryIndexes = body?.solvedCategoryIndexes;

      if (!date || !isValidDate(date)) return setJson(res, 400, { error: "invalid_date" });

      const mistakesNum = Number(mistakesLeft);
      if (!Number.isFinite(mistakesNum) || mistakesNum < 0 || mistakesNum > 4) {
        return setJson(res, 400, { error: "invalid_mistakesLeft" });
      }

      if (!isSolvedArray(solvedCategoryIndexes)) {
        return setJson(res, 400, { error: "invalid_solvedCategoryIndexes" });
      }

      const solvedUnique = Array.from(new Set(solvedCategoryIndexes)).sort((a, b) => a - b);

      const docRef = adminDb.collection("users").doc(uid).collection("connections").doc(date);

      await docRef.set(
        {
          mistakesLeft: mistakesNum,
          solvedCategoryIndexes: solvedUnique,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );

      setJson(res, 200, { ok: true });
    } catch (e: any) {
      setJson(res, 500, { error: typeof e?.message === "string" ? e.message : "unknown_error" });
    }
    return;
  }

  setJson(res, 405, { error: "Method Not Allowed" });
}

async function connectionsWin(req: Req, res: Res) {
  if (req.method !== "POST") return setJson(res, 405, { error: "Method Not Allowed" });

  const { get } = parseCookies(req);
  const userId = get("user_id");
  const signedIn = get("signed_in") === "1";
  if (!signedIn || !userId) return setJson(res, 401, { error: "unauthorized" });
  if (!requireFirebaseEnv(res)) return;

  try {
    const body = await readJsonBody(req);
    const mistakesUsed = Number(body?.mistakesUsed);
    if (!Number.isFinite(mistakesUsed) || mistakesUsed < 0 || mistakesUsed > 4) {
      return setJson(res, 400, { error: "invalid_mistakesUsed" });
    }

    const { adminDb, admin } = await import("../lib/firebase-admin.js");
    const userRef = adminDb.collection("users").doc(decodeURIComponent(userId));

    await userRef.set(
      {
        connections_completed: admin.firestore.FieldValue.increment(1),
        connections_games_played: admin.firestore.FieldValue.increment(1),
        ["connections_in_" + mistakesUsed]: admin.firestore.FieldValue.increment(1),
      },
      { merge: true },
    );

    setJson(res, 200, { ok: true });
  } catch (e: any) {
    setJson(res, 500, { error: typeof e?.message === "string" ? e.message : "unknown_error" });
  }
}

async function connectionsLoss(req: Req, res: Res) {
  if (req.method !== "POST") return setJson(res, 405, { error: "Method Not Allowed" });

  const { get } = parseCookies(req);
  const userId = get("user_id");
  const signedIn = get("signed_in") === "1";
  if (!signedIn || !userId) return setJson(res, 401, { error: "unauthorized" });
  if (!requireFirebaseEnv(res)) return;

  try {
    const { adminDb, admin } = await import("../lib/firebase-admin.js");
    const userRef = adminDb.collection("users").doc(decodeURIComponent(userId));

    await userRef.set(
      {
        connections_games_played: admin.firestore.FieldValue.increment(1),
        connections_failed: admin.firestore.FieldValue.increment(1),
      },
      { merge: true },
    );

    setJson(res, 200, { ok: true });
  } catch (e: any) {
    setJson(res, 500, { error: typeof e?.message === "string" ? e.message : "unknown_error" });
  }
}

async function connectionsStats(req: Req, res: Res) {
  if (req.method !== "GET") return setJson(res, 405, { error: "Method Not Allowed" });

  const { get } = parseCookies(req);
  const userId = get("user_id");
  const signedIn = get("signed_in") === "1";
  if (!signedIn || !userId) return setJson(res, 401, { error: "unauthorized" });
  if (!requireFirebaseEnv(res)) return;

  try {
    const { adminDb } = await import("../lib/firebase-admin.js");
    const snap = await adminDb.collection("users").doc(decodeURIComponent(userId)).get();

    const data = (snap.exists ? snap.data() : {}) as Record<string, any>;
    const games_played = Number(data?.connections_games_played || 0);
    const connections_completed = Number(data?.connections_completed || 0);

    const distribution: Record<string, number> = {};
    for (let i = 0; i <= 4; i++) {
      const k = `connections_in_${i}`;
      const v = Number(data?.[k] || 0);
      distribution[k] = Number.isFinite(v) ? v : 0;
    }

    const winRate = games_played > 0 ? Math.round((connections_completed / games_played) * 100) : 0;

    setJson(res, 200, { games_played, connections_completed, winRate, distribution });
  } catch (e: any) {
    setJson(res, 500, { error: typeof e?.message === "string" ? e.message : "unknown_error" });
  }
}

// ---------------- Wordle routes ----------------

async function wordlePuzzle(req: Req, res: Res, dateFromPath?: string) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") return setJson(res, 405, { error: "Method Not Allowed" });

  const date = dateFromPath || getQueryParam(req, "date");
  if (!date || !isValidDate(date)) {
    return setJson(res, 400, { error: "Invalid date; expected YYYY-MM-DD" });
  }

  const nytUrl = `https://www.nytimes.com/svc/wordle/v2/${date}.json`;

  try {
    const upstream = await fetch(nytUrl, {
      headers: {
        "User-Agent": "wordle-clone/1.0",
        Accept: "application/json",
      },
    });

    if (!upstream.ok) {
      return setJson(res, upstream.status, { error: "Upstream error", status: upstream.status });
    }

    const data = (await upstream.json()) as { solution?: unknown };
    const solution = typeof data?.solution === "string" ? data.solution.trim().toLowerCase() : "";

    if (!/^[a-z]{5}$/.test(solution)) {
      return setJson(res, 502, { error: "Invalid upstream payload" });
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).end(JSON.stringify({ date, solution }));
  } catch {
    setJson(res, 502, { error: "Failed to fetch upstream" });
  }
}

async function wordleProgress(req: Req, res: Res) {
  const { get } = parseCookies(req);
  const userId = get("user_id");
  const signedIn = get("signed_in") === "1";
  if (!signedIn || !userId) return setJson(res, 401, { error: "unauthorized" });
  if (!requireFirebaseEnv(res)) return;

  const { adminDb } = await import("../lib/firebase-admin.js");
  const uid = decodeURIComponent(userId);

  if (req.method === "GET") {
    const date = getQueryParam(req, "date");
    if (!date || !isValidDate(date)) return setJson(res, 400, { error: "invalid_date" });

    try {
      const docRef = adminDb.collection("users").doc(uid).collection("wordle").doc(date);
      const snap = await docRef.get();
      const data = snap.exists ? snap.data() : {};
      const guesses = Array.isArray(data?.guesses) ? data!.guesses : [];
      const cols = typeof data?.cols === "number" ? data!.cols : undefined;
      setJson(res, 200, { guesses, cols });
    } catch (e: any) {
      setJson(res, 500, { error: typeof e?.message === "string" ? e.message : "unknown_error" });
    }
    return;
  }

  if (req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const date: string | undefined = body?.date;
      const guesses: unknown = body?.guesses;
      const cols: unknown = body?.cols;

      if (!date || !isValidDate(date)) return setJson(res, 400, { error: "invalid_date" });
      if (!Array.isArray(guesses) || !guesses.every((g) => typeof g === "string")) {
        return setJson(res, 400, { error: "invalid_guesses" });
      }

      const colsNum = typeof cols === "number" ? cols : undefined;
      const docRef = adminDb.collection("users").doc(uid).collection("wordle").doc(date);

      await docRef.set(
        { guesses, cols: colsNum, updatedAt: new Date().toISOString() },
        { merge: true },
      );

      setJson(res, 200, { ok: true });
    } catch (e: any) {
      setJson(res, 500, { error: typeof e?.message === "string" ? e.message : "unknown_error" });
    }
    return;
  }

  setJson(res, 405, { error: "Method Not Allowed" });
}

async function wordleWin(req: Req, res: Res) {
  if (req.method !== "POST") return setJson(res, 405, { error: "Method Not Allowed" });

  const { get } = parseCookies(req);
  const userId = get("user_id");
  const signedIn = get("signed_in") === "1";
  if (!signedIn || !userId) return setJson(res, 401, { error: "unauthorized" });
  if (!requireFirebaseEnv(res)) return;

  try {
    const body = await readJsonBody(req);
    const guessCount = Number(body?.guessCount);
    if (!Number.isFinite(guessCount) || guessCount < 1 || guessCount > 10) {
      return setJson(res, 400, { error: "invalid_guessCount" });
    }

    const { adminDb, admin } = await import("../lib/firebase-admin.js");
    const userRef = adminDb.collection("users").doc(decodeURIComponent(userId));

    await userRef.set(
      {
        wordles_completed: admin.firestore.FieldValue.increment(1),
        games_played: admin.firestore.FieldValue.increment(1),
        ["wordle_in_" + guessCount]: admin.firestore.FieldValue.increment(1),
      },
      { merge: true },
    );

    setJson(res, 200, { ok: true });
  } catch (e: any) {
    setJson(res, 500, { error: typeof e?.message === "string" ? e.message : "unknown_error" });
  }
}

async function wordleLoss(req: Req, res: Res) {
  if (req.method !== "POST") return setJson(res, 405, { error: "Method Not Allowed" });

  const { get } = parseCookies(req);
  const userId = get("user_id");
  const signedIn = get("signed_in") === "1";
  if (!signedIn || !userId) return setJson(res, 401, { error: "unauthorized" });
  if (!requireFirebaseEnv(res)) return;

  try {
    const { adminDb, admin } = await import("../lib/firebase-admin.js");
    const userRef = adminDb.collection("users").doc(decodeURIComponent(userId));

    await userRef.set(
      {
        games_played: admin.firestore.FieldValue.increment(1),
        wordles_failed: admin.firestore.FieldValue.increment(1),
      },
      { merge: true },
    );

    setJson(res, 200, { ok: true });
  } catch (e: any) {
    setJson(res, 500, { error: typeof e?.message === "string" ? e.message : "unknown_error" });
  }
}

async function wordleStats(req: Req, res: Res) {
  if (req.method !== "GET") return setJson(res, 405, { error: "Method Not Allowed" });

  const { get } = parseCookies(req);
  const userId = get("user_id");
  const signedIn = get("signed_in") === "1";
  if (!signedIn || !userId) return setJson(res, 401, { error: "unauthorized" });
  if (!requireFirebaseEnv(res)) return;

  try {
    const { adminDb } = await import("../lib/firebase-admin.js");
    const snap = await adminDb.collection("users").doc(decodeURIComponent(userId)).get();

    const data = (snap.exists ? snap.data() : {}) as Record<string, any>;
    const games_played = Number(data?.games_played || 0);
    const wordles_completed = Number(data?.wordles_completed || 0);

    const distribution: Record<string, number> = {};
    for (let i = 1; i <= 10; i++) {
      const k = `wordle_in_${i}`;
      const v = Number(data?.[k] || 0);
      distribution[k] = v > 0 ? v : 0;
    }

    const winRate = games_played > 0 ? Math.round((wordles_completed / games_played) * 100) : 0;

    setJson(res, 200, { games_played, wordles_completed, winRate, distribution });
  } catch (e: any) {
    setJson(res, 500, { error: typeof e?.message === "string" ? e.message : "unknown_error" });
  }
}

// ---------------- Main router ----------------

export default async function handler(req: Req, res: Res) {
  const segs = getPathSegments(req);

  // /api without a path is not a public endpoint
  if (segs.length === 0) {
    return setJson(res, 404, { error: "not_found" });
  }

  const [root, a, b] = segs;

  if (root === "auth") {
    if (a === "me") return authMe(req, res);
    if (a === "profile") return authProfile(req, res);
    if (a === "signout") return authSignout(req, res);
    if (a === "callback" && b === "google") return authCallbackGoogle(req, res);
    return setJson(res, 404, { error: "not_found" });
  }

  if (root === "connections") {
    if (a === "stats") return connectionsStats(req, res);
    if (a === "progress") return connectionsProgress(req, res);
    if (a === "win") return connectionsWin(req, res);
    if (a === "loss") return connectionsLoss(req, res);

    // support /api/connections/:date
    if (a && isValidDate(a)) return connectionsPuzzle(req, res, a);

    // fallback to /api/connections?date=...
    if (!a) return connectionsPuzzle(req, res);

    return setJson(res, 404, { error: "not_found" });
  }

  if (root === "wordle") {
    if (a === "stats") return wordleStats(req, res);
    if (a === "progress") return wordleProgress(req, res);
    if (a === "win") return wordleWin(req, res);
    if (a === "loss") return wordleLoss(req, res);

    // support /api/wordle/:date
    if (a && isValidDate(a)) return wordlePuzzle(req, res, a);

    // fallback to /api/wordle?date=...
    if (!a) return wordlePuzzle(req, res);

    return setJson(res, 404, { error: "not_found" });
  }

  return setJson(res, 404, { error: "not_found" });
}
