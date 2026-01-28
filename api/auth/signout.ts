// Vercel Serverless Function: Clears auth cookie and redirects to '/'
export default async function handler(req: any, res: any) {
  // Clear cookies by expiring them
  res.setHeader("Set-Cookie", [
    `signed_in=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`,
    // clear readable variants
    `signed_in=; Path=/; SameSite=Lax; Secure; Max-Age=0`,
    `display_name=; Path=/; SameSite=Lax; Secure; Max-Age=0`,
    `joined=; Path=/; SameSite=Lax; Secure; Max-Age=0`,
  ]);
  res.status(302).setHeader("Location", "/");
  res.end();
}
