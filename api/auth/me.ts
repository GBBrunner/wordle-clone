// Vercel Serverless Function: Returns auth status based on HttpOnly cookie
export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const cookieHeader = (req.headers["cookie"] || req.headers["Cookie"]) as
    | string
    | undefined;
  const signedIn = Boolean(
    cookieHeader
      ?.split(/;\s*/)
      .find((c: string) => c.startsWith("signed_in="))
      ?.split("=")[1] === "1",
  );

  res.setHeader("Content-Type", "application/json");
  res.status(200).end(JSON.stringify({ signedIn }));
}
