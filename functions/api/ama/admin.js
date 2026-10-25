import {alertStaffOfPendingQuestion} from "./index.js";
// Admin endpoints always verify a signed Cloudflare Access JWT.
// Protect /admin/* and /api/ama/admin through Cloudflare Access as defense in depth.
const reply = (data, status = 200) => Response.json(data, {
  status, headers: {"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}
});
function decodeBase64Url(s) {
  const padded = s.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(s.length / 4) * 4,"=");
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}
export async function verifyAccess(request, env) {
  const domain = env.ACCESS_TEAM_DOMAIN;
  const aud = env.ACCESS_AUD;
  if (!domain || !aud || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain)) return false;
  const token = request.headers.get("Cf-Access-Jwt-Assertion") || "";
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  let header, claims;
  try {
    header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
    claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
  } catch (_) { return false; }
  const now = Math.floor(Date.now()/1000);
  if (header.alg !== "RS256" || !header.kid ||
      claims.iss !== "https://" + domain ||
      !Array.isArray(claims.aud) && typeof claims.aud !== "string" ||
      !(Array.isArray(claims.aud) ? claims.aud.includes(aud) : claims.aud === aud) ||
      !Number.isFinite(claims.exp) || claims.exp <= now ||
      (claims.nbf && claims.nbf > now)) return false;
  try {
    const certs = await fetch("https://" + domain + "/cdn-cgi/access/certs",
      {cf:{cacheTtl:3600,cacheEverything:true}});
    if (!certs.ok) return false;
    const {keys} = await certs.json();
    const key = Array.isArray(keys) && keys.find(k => k.kid === header.kid && k.kty === "RSA");
    if (!key) return false;
    const imported = await crypto.subtle.importKey("jwk", key,
      {name:"RSASSA-PKCS1-v1_5", hash:"SHA-256"},false,["verify"]);
    return await crypto.subtle.verify("RSASSA-PKCS1-v1_5",imported,
      decodeBase64Url(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1]));
  } catch (err) { console.error("Access verification failed",err); return false; }
}
// Lightweight login probe for the public site's staff-only shortcut.
// Uses the exact same protected URL and signed Access JWT verification as
// real moderation, without querying or returning private question data.
export async function onRequestHead({request,env}) {
  const allowed = await verifyAccess(request,env);
  return new Response(null, {
    status: allowed ? 204 : 401,
    headers: {"Cache-Control":"no-store", "X-Content-Type-Options":"nosniff"}
  });
}

export async function onRequestGet({request,env}) {
  if (!await verifyAccess(request,env)) return reply({error:"Unauthorized"},401);
  if (!env.DB) return reply({error:"Database not configured"},503);
  try {
    const data=await env.DB.prepare(
      "SELECT id,display_name,question,created_at FROM ama_questions WHERE status='pending' ORDER BY created_at ASC LIMIT 100"
    ).all();
    return reply({questions:data.results||[]});
  } catch (e) {console.error(e);return reply({error:"Database unavailable"},503);}
}
export async function onRequestPost({request,env}) {
  if (!await verifyAccess(request,env)) return reply({error:"Unauthorized"},401);
  if (request.headers.get("Origin") !== new URL(request.url).origin) return reply({error:"Origin rejected"},403);
  if (!(request.headers.get("Content-Type")||"").startsWith("application/json")) return reply({error:"JSON required"},415);
  let data;
  try {
    const text=await request.text();
    if (text.length>6000) return reply({error:"Too large"},413);
    data=JSON.parse(text);
  }catch(_){return reply({error:"Invalid JSON"},400);}
  // Staff-only, manually initiated end-to-end diagnostic. This uses the
  // exact notification publisher used by new AMA submissions.
  if (data.action === "test_notification") {
    if (!env.AMA_NTFY_URL)
      return reply({ok:false, reason:"missing_production_secret",
        message:"AMA_NTFY_URL is missing from this Cloudflare Pages deployment"},503);
    const result = await alertStaffOfPendingQuestion(env.AMA_NTFY_URL, true);
    // Fingerprint helps compare topic configuration without disclosing the topic.
    const hash = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(env.AMA_NTFY_URL));
    const topicFingerprint = Array.from(new Uint8Array(hash)).slice(0,6)
      .map(v=>v.toString(16).padStart(2,"0")).join("");
    return reply({...result,topicFingerprint},result.ok?200:502);
  }
  if (!env.DB) return reply({error:"Database not configured"},503);
  if (!/^[a-f0-9-]{36}$/.test(data.id||"")) return reply({error:"Invalid ID"},400);
  if (!["publish","reject"].includes(data.action)) return reply({error:"Invalid action"},400);
  const answer=typeof data.answer==="string" ? data.answer.trim() : "";
  if (data.action==="publish" && (answer.length<2||answer.length>2200))
    return reply({error:"Reply must be 2–2200 characters"},400);
  try {
    const now=new Date().toISOString();
    const updated=await env.DB.prepare(
      "UPDATE ama_questions SET status=?, answer=?, answered_at=? WHERE id=? AND status='pending'"
    ).bind(data.action==="publish"?"published":"rejected",
      data.action==="publish"?answer:null,data.action==="publish"?now:null,data.id).run();
    return updated.meta.changes===1 ? reply({ok:true}) : reply({error:"Question unavailable or already moderated"},409);
  }catch(e){console.error(e);return reply({error:"Database unavailable"},503);}
}
