// MINIMAL TEST - Put this in api/auth/callback/google.ts
// This will help us see if the serverless function is even being called

export default async function handler(req: any, res: any) {
  // Log everything
  const debugInfo = {
    method: req.method,
    query: req.query,
    headers: {
      cookie: req.headers.cookie,
      host: req.headers.host,
      referer: req.headers.referer,
    },
  };

  console.log("=== CALLBACK HIT ===", JSON.stringify(debugInfo, null, 2));

  // Return JSON instead of redirect so we can see what's happening
  res.status(200).json({
    message: "✅ Callback function is running!",
    receivedCode: !!req.query.code,
    receivedState: !!req.query.state,
    receivedError: req.query.error || null,
    debug: debugInfo,
  });
}
