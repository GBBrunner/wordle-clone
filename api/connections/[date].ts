// Vercel Serverless Function: Proxy NYT Connections JSON
// Route: /api/connections/:date  (date format: YYYY-MM-DD)

type Req = {
  method?: string;
  query?: Record<string, string | string[]>;
  headers?: Record<string, string | string[] | undefined>;
};

type Res = {
  status: (code: number) => Res;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
  json?: (data: any) => void;
};

function setCors(res: Res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function getQueryParam(req: Req, key: string): string | undefined {
  const v = req.query?.[key];
  if (Array.isArray(v)) return v[0];
  return v;
}

function isValidDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function isValidUpstreamPayload(data: any): boolean {
  if (!data || typeof data !== "object") return false;
  if (!Array.isArray(data.categories) || data.categories.length !== 4) {
    return false;
  }

  // Each category should have { title: string, cards: [{ content: string, position: number }] }
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

export default async function handler(req: Req, res: Res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).end(JSON.stringify({ error: "Method Not Allowed" }));
    return;
  }

  const date = getQueryParam(req, "date");
  if (!date || !isValidDate(date)) {
    res
      .status(400)
      .end(JSON.stringify({ error: "Invalid date; expected YYYY-MM-DD" }));
    return;
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
      res
        .status(upstream.status)
        .end(
          JSON.stringify({ error: "Upstream error", status: upstream.status }),
        );
      return;
    }

    const data = await upstream.json();
    if (!isValidUpstreamPayload(data)) {
      res
        .status(502)
        .end(JSON.stringify({ error: "Invalid upstream payload" }));
      return;
    }

    // Return the payload as-is; the client uses categories/cards.
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400",
    );
    res.status(200).end(JSON.stringify(data));
  } catch {
    res.status(502).end(JSON.stringify({ error: "Failed to fetch upstream" }));
  }
}
