// Debug version of /api/auth/me
// Replace api/auth/me.ts with this temporarily

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const cookieHeader = (req.headers["cookie"] || req.headers["Cookie"]) as
    | string
    | undefined;

  // Parse all cookies
  const cookies: Record<string, string> = {};
  if (cookieHeader) {
    cookieHeader.split(/;\s*/).forEach((cookie) => {
      const [key, value] = cookie.split("=");
      if (key) cookies[key] = value;
    });
  }

  const signedIn = Boolean(
    cookieHeader
      ?.split(/;\s*/)
      .find((c: string) => c.startsWith("signed_in="))
      ?.split("=")[1] === "1",
  );

  res.setHeader("Content-Type", "application/json");
  res.status(200).json({
    signedIn,
    debug: {
      rawCookieHeader: cookieHeader || null,
      parsedCookies: cookies,
      hasSignedInCookie: !!cookies["signed_in"],
      signedInValue: cookies["signed_in"] || null,
    },
  });
}
