// Returns profile info from readable cookies: display_name and joined
export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const cookieHeader = (req.headers["cookie"] || req.headers["Cookie"]) as
    | string
    | undefined;

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

  res.setHeader("Content-Type", "application/json");
  res.status(200).end(
    JSON.stringify({
      signedIn,
      name: name ? decodeURIComponent(name) : null,
      joined: joined ? decodeURIComponent(joined) : null,
    }),
  );
}
