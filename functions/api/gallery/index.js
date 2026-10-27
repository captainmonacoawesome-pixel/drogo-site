// Public gallery API. Captions remain text-only, R2 stays private.
const json = (body,status=200) => Response.json(body,{status,headers:{
  "Cache-Control":"no-store","X-Content-Type-Options":"nosniff"
}});
const COOKIE = "__Host-drogo-heart";
const HEX = /^[0-9a-f]{64}$/;
const TABLE_SQL = `-- One reaction per anonymous browser per photo. No names, email or raw IP stored.
-- Cloudflare Pages initialises these tables on first use; this file is also
-- provided for explicit D1 migrations and disaster recovery.
CREATE TABLE IF NOT EXISTS gallery_hearts (
  photo_id TEXT NOT NULL REFERENCES gallery_photos(id) ON DELETE CASCADE,
  visitor_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (photo_id, visitor_hash)
) WITHOUT ROWID;

-- Throttle excessive voting from the same source without storing raw IPs.
CREATE TABLE IF NOT EXISTS gallery_heart_rate (
  ip_hash TEXT NOT NULL,
  hour_bucket INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, hour_bucket)
) WITHOUT ROWID;`;
let schemaReady;
export function ensureHeartSchema(db) {
  // Avoid DDL on normal reads after migration. D1 exec is only used to
  // bootstrap a database if one of the two heart tables is missing.
  // Memoisation covers a single Worker isolate; failed attempts are retried.
  if (!schemaReady) {
    schemaReady=(async()=>{
      const found=await db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('gallery_hearts','gallery_heart_rate')"
      ).all();
      const names=new Set((found.results||[]).map(row=>row.name));
      if(!names.has("gallery_hearts")||!names.has("gallery_heart_rate")){
        await db.exec(TABLE_SQL);
      }
    })().catch(error=>{schemaReady=null;throw error;});
  }
  return schemaReady;
}
export function cookieToken(request) {
  const cookie = request.headers.get("Cookie") || "";
  for (const field of cookie.split(";")) {
    const entry = field.trim();
    if (entry.startsWith(COOKIE+"=")) {
      const value = entry.slice(COOKIE.length+1);
      return HEX.test(value) ? value : null;
    }
  }
  return null;
}
export function newToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)),
    b=>b.toString(16).padStart(2,"0")).join("");
}
export async function digestIdentity(value, secret, label) {
  if (!secret) throw new Error("Missing visitor hashing configuration");
  const key = await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),
    {name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const signed = await crypto.subtle.sign("HMAC",key,
    new TextEncoder().encode("gallery-heart:"+label+":"+value));
  return Array.from(new Uint8Array(signed),
    b=>b.toString(16).padStart(2,"0")).join("");
}
export function heartCookie(value) {
  return COOKIE+"="+value+"; Path=/; Max-Age=31536000; Secure; HttpOnly; SameSite=Lax";
}

export async function onRequestGet({request,env}) {
  if(!env.DB||!env.PHOTOS)
    return json({photos:[],message:"Gallery coming soon"},503);
  let photos;
  try{
    const result=await env.DB.prepare(
      "SELECT id,caption,created_at,is_photo_of_day FROM gallery_photos ORDER BY created_at DESC LIMIT 100"
    ).all();
    photos=result.results||[];
  }catch(e){
    console.error("Gallery photos query failed",e?.name||"Error");
    return json({error:"Gallery temporarily unavailable",stage:"photos"},503);
  }

  // A reaction subsystem failure should never make all photographs disappear.
  // Do not show invented zero counts when hearts are unavailable.
  let counts=null,mine=new Set(),stage="schema";
  try{
    await ensureHeartSchema(env.DB);
    stage="counts";
    const tally=await env.DB.prepare(
      "SELECT photo_id,COUNT(*) AS n FROM gallery_hearts GROUP BY photo_id"
    ).all();
    counts=new Map((tally.results||[]).map(row=>[row.photo_id,Number(row.n)||0]));
    stage="viewer";
    const token=cookieToken(request);
    if(token){
      const hash=await digestIdentity(token,env.RATE_LIMIT_PEPPER,"browser");
      const result=await env.DB.prepare(
        "SELECT photo_id FROM gallery_hearts WHERE visitor_hash=?"
      ).bind(hash).all();
      mine=new Set((result.results||[]).map(row=>row.photo_id));
    }
  }catch(e){
    console.error("Gallery reaction stage failed",stage,e?.name||"Error");
    // Don't leak SQL, visitor identifiers, or secret configuration.
    counts=null;
  }
  const heartsAvailable=counts!==null;
  return json({
    hearts_available:heartsAvailable,
    ...(heartsAvailable?{}:{hearts_unavailable_stage:stage}),
    photos:photos.map(p=>({
      id:p.id,caption:p.caption,created_at:p.created_at,
      is_photo_of_day:p.is_photo_of_day===1,
      image_url:"/api/gallery/image/"+encodeURIComponent(p.id),
      heart_count:heartsAvailable?(counts.get(p.id)||0):null,
      hearted:heartsAvailable?mine.has(p.id):false
    }))
  });
}
