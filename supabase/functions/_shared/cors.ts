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
  ];

  // Dynamic check for preview branches (*.vercel.app) and localhost ports
  const isAllowed = allowedOrigins.includes(origin) || 
                    origin.endsWith(".vercel.app") || 
                    origin.endsWith(".vitalsync.in") ||
                    /^https?:\/\/localhost(:\d+)?$/.test(origin);

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "https://app.vitalsync.in",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
  };
}
