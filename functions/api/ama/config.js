// Public client configuration. The Turnstile site key is deliberately public.
export async function onRequestGet({env}) {
  return Response.json({
    enabled: Boolean(env.DB && env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET && env.RATE_LIMIT_PEPPER),
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || null
  }, {headers: {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}});
}
