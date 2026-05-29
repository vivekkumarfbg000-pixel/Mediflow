// =============================================================================
// Mediflow — Shared Rate Limiter for Edge Functions
// Invokes the public.check_rate_limit Postgres function via RPC.
// =============================================================================

export async function isRateLimited(
  req: Request, 
  supabaseClient: any, 
  maxRequests = 15, 
  windowSeconds = 60
): Promise<boolean> {
  // Capture client IP address from standard load-balancer / CDN headers
  const ip = req.headers.get("x-real-ip") || 
             req.headers.get("x-forwarded-for")?.split(",")[0].trim() || 
             req.headers.get("cf-connecting-ip") || 
             "unknown";

  if (ip === "unknown") {
    console.warn("[Rate Limiter] Unidentifiable client IP header. Allowing request.");
    return false; // Fail open
  }

  try {
    const { data: allowed, error } = await supabaseClient.rpc("check_rate_limit", {
      p_ip: ip,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds
    });

    if (error) {
      console.error(`[Rate Limiter] Database RPC error for IP ${ip}:`, error);
      return false; // Fail open to avoid blocking valid traffic in database outage
    }

    if (!allowed) {
      console.warn(`[Rate Limiter] Limit exceeded for client IP: ${ip} (${maxRequests} req / ${windowSeconds}s)`);
    }

    return !allowed;
  } catch (err) {
    console.error("[Rate Limiter] Exception during rate check:", err);
    return false; // Fail open
  }
}
