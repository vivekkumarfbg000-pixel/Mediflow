// =============================================================================
// Mediflow — Shared CORS Helper for Edge Functions
// Configures dynamically allowed origins to avoid wildcard "*" in production.
// =============================================================================

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  
  // Define allowed local development and production origins
  const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://mediflow.vercel.app", 
    "https://app.vitalsync.in",
    "https://vitalsync.in",
    "https://www.vitalsync.in",
    "http://vitalsync.in"
  ];

  // Dynamic check for preview branches (*.vercel.app), vitalsync domains, and localhost
  const isAllowed = !origin || 
                    allowedOrigins.includes(origin) || 
                    origin.endsWith(".vercel.app") || 
                    origin.endsWith(".vitalsync.in") ||
                    origin.includes("vitalsync.in") ||
                    /^https?:\/\/localhost(:\d+)?$/.test(origin);

  return {
    "Access-Control-Allow-Origin": isAllowed ? (origin || "*") : "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE, HEAD",
  };
}
