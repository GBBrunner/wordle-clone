// Diagnostic version - identifies Firebase issue
export default async function handler(req: any, res: any) {
  const diagnostics = {
    hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
    hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
    hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
    privateKeyStart:
      process.env.FIREBASE_PRIVATE_KEY?.substring(0, 30) || "missing",
  };

  // If this is a test request, show diagnostics
  if (req.query.test === "1") {
    return res.status(200).json({
      message: "Firebase diagnostics",
      diagnostics,
      nodeVersion: process.version,
    });
  }

  // Normal OAuth flow continues...
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  const error = req.query.error as string | undefined;

  if (error) {
    res
      .status(302)
      .setHeader("Location", `/login?error=${encodeURIComponent(error)}`);
    res.end();
    return;
  }

  if (!code) {
    res.status(400).json({ error: "missing_code" });
    return;
  }

  const cookieHeader = (req.headers["cookie"] || req.headers["Cookie"]) as
    | string
    | undefined;
  const cookieState = cookieHeader
    ?.split(/;\s*/)
    .find((c: string) => c.startsWith("oauth_state="))
    ?.split("=")[1];

  if (!state || !cookieState || state !== cookieState) {
    res
      .status(302)
      .setHeader(
        "Location",
        `/login?error=${encodeURIComponent("invalid_state")}`,
      );
    res.end();
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  let redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI;

  if (!redirectUri) {
    const host = (req.headers["x-forwarded-host"] ||
      req.headers.host) as string;
    const proto = (req.headers["x-forwarded-proto"] || "https") as string;
    redirectUri = `${proto}://${host}/api/auth/callback/google`;
  }

  if (!clientId || !clientSecret || !redirectUri) {
    res.status(500).json({ error: "server_env_missing" });
    return;
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
      const text = await tokenRes.text();
      res
        .status(302)
        .setHeader(
          "Location",
          `/login?error=${encodeURIComponent("token_exchange_failed")}`,
        );
      res.end();
      return;
    }

    const tokens = await tokenRes.json();
    const accessToken = tokens.access_token as string | undefined;

    let profile: any = null;
    if (accessToken) {
      const profRes = await fetch(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      if (profRes.ok) {
        profile = await profRes.json();

        // Try Firebase with detailed error reporting
        if (profile.sub) {
          try {
            console.log("Attempting Firebase init with:", diagnostics);
            const { adminDb } = await import("../../../lib/firebase-admin.js");
            console.log("Firebase Admin imported successfully");

            await adminDb.collection("users").doc(profile.sub).set(
              {
                email: profile.email,
                name: profile.name,
                picture: profile.picture,
                lastLogin: new Date().toISOString(),
              },
              { merge: true },
            );
            console.log("Firestore write successful");
          } catch (firebaseError: any) {
            console.error("Firebase error details:", {
              message: firebaseError.message,
              code: firebaseError.code,
              stack: firebaseError.stack?.substring(0, 200),
              diagnostics,
            });
            // Continue auth flow despite Firebase error
          }
        }
      }
    }

    const cookies: string[] = [];
    const oneWeek = 60 * 60 * 24 * 7;
    cookies.push(`signed_in=1; Path=/; HttpOnly; Max-Age=${oneWeek}`);
    const display = encodeURIComponent(
      profile?.name || profile?.email || "User",
    );
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
    console.error("OAuth error:", e.message);
    res
      .status(302)
      .setHeader(
        "Location",
        `/login?error=${encodeURIComponent("unexpected_error")}`,
      );
    res.end();
  }
}
