// Public, moderated question board. NO public route may publish a reply.
const json = (data, status = 200) => Response.json(data, {
  status, headers: {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}
});
function cleanText(value, max) {
  return typeof value === "string" ? value.trim().replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max + 1) : "";
}
async function ipDigest(ip, pepper) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pepper),
    {name: "HMAC", hash: "SHA-256"}, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2,"0")).join("");
}
export async function onRequestGet({env}) {
  if (!env.DB) return json({questions: [], message: "The cat is preparing his throne."}, 503);
  try {
    const result = await env.DB.prepare(
      "SELECT id, display_name, question, answer, answered_at FROM ama_questions WHERE status='published' ORDER BY answered_at DESC LIMIT 50"
    ).all();
    return json({questions: result.results || []});
  } catch (err) { console.error("AMA read failed", err); return json({error: "Board is temporarily unavailable"}, 503); }
}
export async function onRequestPost({request, env}) {
  if (!env.DB || !env.TURNSTILE_SECRET || !env.RATE_LIMIT_PEPPER || !env.TURNSTILE_SITE_KEY)
    return json({error: "Questions are not open yet"}, 503);
  const url = new URL(request.url);
  if (request.headers.get("Origin") !== url.origin) return json({error: "Origin rejected"}, 403);
  if (!(request.headers.get("Content-Type") || "").startsWith("application/json")) return json({error:"JSON required"},415);
  if (Number(request.headers.get("Content-Length") || 0) > 8000) return json({error:"Request too large"},413);
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 8000) return json({error:"Request too large"},413);
    body = JSON.parse(raw);
  } catch (_) { return json({error:"Invalid request"},400); }
  // Honeypot rejects obvious automation; it is NOT a substitute for Turnstile.
  if (body.website) return json({ok:true});
  const name = cleanText(body.name, 60);
  const question = cleanText(body.question, 1200);
  if (name.length < 1 || name.length > 60 || question.length < 10 || question.length > 1200)
    return json({error:"Please add a name and a question (10–1200 characters)"},400);
  const token = typeof body.turnstileToken === "string" ? body.turnstileToken : "";
  if (!token || token.length > 2048) return json({error:"Please complete the verification"},400);
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  let check;
  try {
    const reply = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method:"POST",
      body:new URLSearchParams({secret:env.TURNSTILE_SECRET,response:token,remoteip:ip})
    });
    check = await reply.json();
  } catch (_) { return json({error:"Verification temporarily unavailable"},503); }
  if (!check.success || check.hostname !== url.hostname) return json({error:"Verification failed. Please try again."},403);
  try {
    const hash = await ipDigest(ip, env.RATE_LIMIT_PEPPER);
    const sinceHour = new Date(Date.now()-3600e3).toISOString();
    const sinceDay = new Date(Date.now()-86400e3).toISOString();
    const counts = await env.DB.prepare(
      "SELECT SUM(CASE WHEN created_at > ? THEN 1 ELSE 0 END) AS hour_count, COUNT(*) AS day_count FROM ama_rate WHERE ip_hash=? AND created_at>?"
    ).bind(sinceHour,hash,sinceDay).first();
    if (Number(counts?.hour_count || 0) >= 3 || Number(counts?.day_count || 0) >= 10)
      return json({error:"The cat is resting. Try again later."},429);
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO ama_questions (id,display_name,question,status,created_at) VALUES (?,?,?,'pending',?)")
        .bind(crypto.randomUUID(),name,question,now),
      env.DB.prepare("INSERT INTO ama_rate (ip_hash,created_at) VALUES (?,?)").bind(hash,now)
    ]);
    return json({ok:true,message:"Your question is awaiting the cat's approval."},202);
  } catch (err) { console.error("AMA submission failed",err); return json({error:"Unable to save question"},503); }
}
