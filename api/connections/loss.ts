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

  try {
    const { adminDb, admin } = await import("../../lib/firebase-admin.js");
    const userRef = adminDb.collection("users").doc(decodeURIComponent(userId));

    await userRef.set(
      {
        connections_games_played: admin.firestore.FieldValue.increment(1),
        connections_failed: admin.firestore.FieldValue.increment(1),
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
}
