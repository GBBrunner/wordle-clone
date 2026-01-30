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

function isValidDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function isSolvedArray(v: unknown): v is number[] {
  return (
    Array.isArray(v) &&
    v.every(
      (x) =>
        Number.isFinite(x) &&
        Number.isInteger(x) &&
        x >= 0 &&
        x <= 3,
    )
  );
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
  if (
    !diagnostics.hasProjectId ||
    !diagnostics.hasClientEmail ||
    !diagnostics.hasPrivateKey
  ) {
    res.setHeader("Content-Type", "application/json");
    res
      .status(500)
      .end(JSON.stringify({ error: "server_env_missing", diagnostics }));
    return;
  }

  const { adminDb } = await import("../../lib/firebase-admin.js");
  const uid = decodeURIComponent(userId);

  if (req.method === "GET") {
    const date = getQueryParam(req, "date");
    if (!date || !isValidDate(date)) {
      res.setHeader("Content-Type", "application/json");
      res.status(400).end(JSON.stringify({ error: "invalid_date" }));
      return;
    }
    try {
      const docRef = adminDb
        .collection("users")
        .doc(uid)
        .collection("connections")
        .doc(date);
      const snap = await docRef.get();
      const data = snap.exists ? snap.data() : {};

      const mistakesLeft =
        typeof data?.mistakesLeft === "number" ? data!.mistakesLeft : 4;
      const solvedCategoryIndexes = isSolvedArray(data?.solvedCategoryIndexes)
        ? (data!.solvedCategoryIndexes as number[])
        : [];

      res.setHeader("Content-Type", "application/json");
      res
        .status(200)
        .end(JSON.stringify({ mistakesLeft, solvedCategoryIndexes }));
    } catch (e: any) {
      const msg = typeof e?.message === "string" ? e.message : "unknown_error";
      res.setHeader("Content-Type", "application/json");
      res.status(500).end(JSON.stringify({ error: msg }));
    }
    return;
  }

  if (req.method === "POST") {
    try {
      const body =
        typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const date: string | undefined = body?.date;
      const mistakesLeft = body?.mistakesLeft;
      const solvedCategoryIndexes = body?.solvedCategoryIndexes;

      if (!date || !isValidDate(date)) {
        res.setHeader("Content-Type", "application/json");
        res.status(400).end(JSON.stringify({ error: "invalid_date" }));
        return;
      }

      const mistakesNum = Number(mistakesLeft);
      if (!Number.isFinite(mistakesNum) || mistakesNum < 0 || mistakesNum > 4) {
        res.setHeader("Content-Type", "application/json");
        res.status(400).end(JSON.stringify({ error: "invalid_mistakesLeft" }));
        return;
      }

      if (!isSolvedArray(solvedCategoryIndexes)) {
        res.setHeader("Content-Type", "application/json");
        res
          .status(400)
          .end(JSON.stringify({ error: "invalid_solvedCategoryIndexes" }));
        return;
      }

      // de-dupe + sort for stable storage
      const solvedUnique = Array.from(new Set(solvedCategoryIndexes)).sort(
        (a, b) => a - b,
      );

      const docRef = adminDb
        .collection("users")
        .doc(uid)
        .collection("connections")
        .doc(date);

      await docRef.set(
        {
          mistakesLeft: mistakesNum,
          solvedCategoryIndexes: solvedUnique,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );

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
