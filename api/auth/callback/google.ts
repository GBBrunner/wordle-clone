// Vercel Serverless Function: Google OAuth code exchange
// Exchanges ?code for tokens and redirects back to the app.

export default async function handler(req: any, res: any) {
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

  // Validate OAuth state to mitigate CSRF
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

  // Fallback: derive origin-based redirect for preview deployments
  if (!redirectUri) {
    const host = (req.headers["x-forwarded-host"] ||
      req.headers.host) as string;
    const proto = (req.headers["x-forwarded-proto"] || "https") as string;
    const origin = `${proto}://${host}`;
    redirectUri = `${origin}/api/auth/callback/google`;
  }

  if (!clientId || !clientSecret || !redirectUri) {
    res.status(500).json({
      error: "server_env_missing",
      missing: {
        clientId: !clientId,
        clientSecret: !clientSecret,
        redirectUri: !redirectUri,
      },
    });
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
      res.setHeader("X-Error-Detail", text);
      res.end();
      return;
    }

    const tokens = await tokenRes.json();
    const accessToken = tokens.access_token as string | undefined;

    // Optional: fetch basic profile (email, name)
    let profile: any = null;
    if (accessToken) {
      const profRes = await fetch(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      if (profRes.ok) profile = await profRes.json();
    }

    // Detect if we're on HTTPS or HTTP (for local development)
    const host = (req.headers["x-forwarded-host"] ||
      req.headers.host) as string;
    const proto = (req.headers["x-forwarded-proto"] ||
      req.headers["x-forwarded-proto"] ||
      "https") as string;
    const isSecure = proto === "https";

    // Build cookies: HttpOnly session + readable display name + first join date
    const cookies: string[] = [];
    const oneWeek = 60 * 60 * 24 * 7;
    const secureFlag = isSecure ? " Secure;" : "";

    cookies.push(
      `signed_in=1; Path=/; HttpOnly; SameSite=Lax;${secureFlag} Max-Age=${oneWeek}`,
    );

    const display = encodeURIComponent(
      profile?.name || profile?.email || "User",
    );
    cookies.push(
      `display_name=${display}; Path=/; SameSite=Lax;${secureFlag} Max-Age=${oneWeek}`,
    );

    // If user doesn't already have a joined cookie, set one now
    const hasJoined = (cookieHeader || "")
      .split(/;\s*/)
      .some((c: string) => c.startsWith("joined="));
    if (!hasJoined) {
      const joined = encodeURIComponent(new Date().toISOString());
      cookies.push(
        `joined=${joined}; Path=/; SameSite=Lax;${secureFlag} Max-Age=${oneWeek}`,
      );
    }

    res.setHeader("Set-Cookie", cookies);

    // Redirect into the app home after successful sign-in
    res.status(302).setHeader("Location", `/`);
    res.end();
  } catch (e: any) {
    res
      .status(302)
      .setHeader(
        "Location",
        `/login?error=${encodeURIComponent("unexpected_error")}`,
      );
    res.setHeader("X-Error", String(e?.message || e));
    res.end();
  }
}
