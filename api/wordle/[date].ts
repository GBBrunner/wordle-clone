// Vercel Serverless Function: Proxy NYT Wordle JSON -> { date, solution }
// Route: /api/wordle/:date  (date format: YYYY-MM-DD)

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
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res
      .status(400)
      .end(JSON.stringify({ error: "Invalid date; expected YYYY-MM-DD" }));
    return;
  }

  const nytUrl = `https://www.nytimes.com/svc/wordle/v2/${date}.json`;

  try {
    const upstream = await fetch(nytUrl, {
      headers: {
        // Provide a UA for environments that care; harmless otherwise.
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

    const data = (await upstream.json()) as { solution?: unknown };
    const solution =
      typeof data?.solution === "string"
        ? data.solution.trim().toLowerCase()
        : "";

    if (!/^[a-z]{5}$/.test(solution)) {
      res
        .status(502)
        .end(JSON.stringify({ error: "Invalid upstream payload" }));
      return;
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400",
    );
    res.status(200).end(JSON.stringify({ date, solution }));
  } catch {
    res.status(502).end(JSON.stringify({ error: "Failed to fetch upstream" }));
  }
}
