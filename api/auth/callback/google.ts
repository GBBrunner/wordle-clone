// ULTRA-DEBUG OAuth callback - tells us exactly where it fails
export default async function handler(req: any, res: any) {
  const logs: string[] = [];
  logs.push("1. Handler called");

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method Not Allowed", logs });
    return;
  }
  logs.push("2. Method is GET");

  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  const error = req.query.error as string | undefined;

  if (error) {
    logs.push("3. ERROR from Google: " + error);
    res.status(200).json({ error: "google_error", detail: error, logs });
    return;
  }
  logs.push("3. No error from Google");

  if (!code) {
    logs.push("4. ERROR: No code");
    res.status(200).json({ error: "missing_code", logs });
    return;
  }
  logs.push("4. Got code: " + code.substring(0, 20) + "...");

  // Validate OAuth state
  const cookieHeader = (req.headers["cookie"] || req.headers["Cookie"]) as
    | string
    | undefined;
  const cookieState = cookieHeader
    ?.split(/;\s*/)
    .find((c: string) => c.startsWith("oauth_state="))
    ?.split("=")[1];

  logs.push("5. State from URL: " + (state || "missing"));
  logs.push("6. State from cookie: " + (cookieState || "missing"));

  if (!state || !cookieState || state !== cookieState) {
    logs.push("7. ERROR: State mismatch");
    res.status(200).json({ error: "invalid_state", logs });
    return;
  }
  logs.push("7. State validated");

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

  logs.push("8. Client ID: " + (clientId ? "SET" : "MISSING"));
  logs.push("9. Client Secret: " + (clientSecret ? "SET" : "MISSING"));
  logs.push("10. Redirect URI: " + redirectUri);

  if (!clientId || !clientSecret || !redirectUri) {
    logs.push("11. ERROR: Missing env vars");
    res.status(200).json({ error: "server_env_missing", logs });
    return;
  }
  logs.push("11. All env vars present");

  try {
    logs.push("12. Calling Google token endpoint...");
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

    logs.push("13. Token response status: " + tokenRes.status);

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      logs.push("14. ERROR: Token exchange failed: " + text.substring(0, 100));
      res
        .status(200)
        .json({ error: "token_exchange_failed", detail: text, logs });
      return;
    }
    logs.push("14. Token exchange successful");

    const tokens = await tokenRes.json();
    const accessToken = tokens.access_token as string | undefined;
    logs.push("15. Got access token: " + (accessToken ? "YES" : "NO"));

    let profile: any = null;
    if (accessToken) {
      logs.push("16. Fetching user profile...");
      const profRes = await fetch(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      if (profRes.ok) {
        profile = await profRes.json();
        logs.push("17. Got profile: " + (profile.email || "no email"));
      } else {
        logs.push("17. Profile fetch failed: " + profRes.status);
      }
    }

    logs.push("18. Building cookies...");
    const cookies: string[] = [];
    const oneWeek = 60 * 60 * 24 * 7;

    const signedInCookie = `signed_in=1; Path=/; HttpOnly; Max-Age=${oneWeek}`;
    cookies.push(signedInCookie);
    logs.push("19. Cookie 1: " + signedInCookie);

    const display = encodeURIComponent(
      profile?.name || profile?.email || "User",
    );
    const displayCookie = `display_name=${display}; Path=/; Max-Age=${oneWeek}`;
    cookies.push(displayCookie);
    logs.push("20. Cookie 2: " + displayCookie);

    const hasJoined = (cookieHeader || "")
      .split(/;\s*/)
      .some((c: string) => c.startsWith("joined="));
    if (!hasJoined) {
      const joined = encodeURIComponent(new Date().toISOString());
      const joinedCookie = `joined=${joined}; Path=/; Max-Age=${oneWeek}`;
      cookies.push(joinedCookie);
      logs.push("21. Cookie 3: " + joinedCookie);
    } else {
      logs.push("21. Joined cookie already exists, skipping");
    }

    logs.push("22. Setting " + cookies.length + " cookies");
    logs.push("23. About to set Set-Cookie header...");

    res.setHeader("Set-Cookie", cookies);
    logs.push("24. Set-Cookie header set");

    logs.push("25. Setting redirect to /");
    logs.push("26. SUCCESS - returning JSON (not redirecting for debug)");

    // Return JSON instead of redirecting so we can see the logs
    res.status(200).json({
      success: true,
      message: "Would redirect to / now",
      cookiesSet: cookies.length,
      logs,
    });
  } catch (e: any) {
    logs.push("ERROR: " + e.message);
    res
      .status(200)
      .json({ error: "unexpected_error", detail: e.message, logs });
  }
}
