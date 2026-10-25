// Ripper-only, read-only notification feed.
// Returns *only* random IDs and creation timestamps. Never visitor content.
// Requests fail closed without a dedicated 256-bit bearer token.
const respond = (payload, status=200) => Response.json(payload, {
  status,
  headers: {
    "Cache-Control":"no-store",
    "Pragma":"no-cache",
    "Vary":"Authorization",
    "X-Content-Type-Options":"nosniff"
  }
});

function tokenMatches(header, token) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return false;
  const expected = new TextEncoder().encode("Bearer " + token);
  const presented = new TextEncoder().encode(header || "");
  if (expected.length !== presented.length) return false;
  let different=0;
  for (let i=0;i<expected.length;i++) different |= expected[i] ^ presented[i];
  return different === 0;
}

export async function onRequestGet({request,env}) {
  if (!env.DB || !tokenMatches(request.headers.get("Authorization"),env.AMA_ALERT_READ_TOKEN))
    return respond({error:"Unauthorized"},401);
  // A rolling 14-day window means a temporarily offline Ripper can catch up.
  // All statuses are included so fast moderation cannot erase an event.
  const cutoff = new Date(Date.now()-14*86400_000).toISOString();
  try {
    const rows = await env.DB.prepare(
      "SELECT id,created_at FROM ama_questions WHERE created_at>=? ORDER BY created_at,id LIMIT 501"
    ).bind(cutoff).all();
    const events = rows.results || [];
    if (events.length > 500) {
      console.warn("AMA alert feed exceeded 500 events in 14 days");
      return respond({error:"Feed exceeds alert safety limit"},503);
    }
    return respond({events:events.map(({id,created_at})=>({id,created_at}))});
  } catch (err) {
    console.error("AMA alert feed read failed",err?.name || "Error");
    return respond({error:"Alert feed unavailable"},503);
  }
}
