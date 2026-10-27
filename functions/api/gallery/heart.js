// Public, idempotent like/unlike API. One heart per anonymous browser per photo.
// Existing D1 binding and RATE_LIMIT_PEPPER; no new secrets or public storage.
import {
  ensureHeartSchema, cookieToken, newToken, digestIdentity, heartCookie
} from "./index.js";

const json = (body,status=200,cookie=null) => {
  const headers={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
  if(cookie)headers["Set-Cookie"]=cookie;
  return Response.json(body,{status,headers});
};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function onRequestPost({request,env}) {
  if(!env.DB||!env.PHOTOS||!env.RATE_LIMIT_PEPPER)
    return json({error:"Reactions unavailable"},503);
  if(request.headers.get("Origin")!==new URL(request.url).origin)
    return json({error:"Origin rejected"},403);
  if(!(request.headers.get("Content-Type")||"").startsWith("application/json"))
    return json({error:"JSON required"},415);
  if(Number(request.headers.get("Content-Length")||0)>500)
    return json({error:"Request too large"},413);
  let data;
  try{
    const raw=await request.text();
    if(raw.length>500)return json({error:"Request too large"},413);
    data=JSON.parse(raw);
  }catch(_){return json({error:"Invalid JSON"},400);}
  const id=data && typeof data.id==="string"?data.id:"";
  if(!UUID.test(id)||typeof data?.liked!=="boolean")
    return json({error:"Invalid heart request"},400);

  try{
    await ensureHeartSchema(env.DB);
    // Deleted photos cannot receive hearts.
    const photo=await env.DB.prepare("SELECT id FROM gallery_photos WHERE id=?").bind(id).first();
    if(!photo)return json({error:"Photo not found"},404);

    const ip=request.headers.get("CF-Connecting-IP")||"unknown";
    const ipHash=await digestIdentity(ip,env.RATE_LIMIT_PEPPER,"ip");
    const hour=Math.floor(Date.now()/3600000);
    await env.DB.prepare(
      "INSERT INTO gallery_heart_rate(ip_hash,hour_bucket,attempts) VALUES(?,?,1) "+
      "ON CONFLICT(ip_hash,hour_bucket) DO UPDATE SET attempts=attempts+1"
    ).bind(ipHash,hour).run();
    const throttled=await env.DB.prepare(
      "SELECT attempts FROM gallery_heart_rate WHERE ip_hash=? AND hour_bucket=?"
    ).bind(ipHash,hour).first();
    if(Number(throttled?.attempts||0)>40)
      return json({error:"Too many reactions from this connection; please try later"},429);

    // Occasionally prune old rate buckets; D1 retains hashes, never clear IPs.
    if(crypto.getRandomValues(new Uint8Array(1))[0]===0) {
      await env.DB.prepare("DELETE FROM gallery_heart_rate WHERE hour_bucket<?")
        .bind(hour-48).run();
    }

    const existing=cookieToken(request);
    const token=existing||newToken();
    const hash=await digestIdentity(token,env.RATE_LIMIT_PEPPER,"browser");
    if(data.liked) {
      await env.DB.prepare(
        "INSERT OR IGNORE INTO gallery_hearts(photo_id,visitor_hash,created_at) VALUES(?,?,?)"
      ).bind(id,hash,new Date().toISOString()).run();
    }else if(existing) {
      await env.DB.prepare(
        "DELETE FROM gallery_hearts WHERE photo_id=? AND visitor_hash=?"
      ).bind(id,hash).run();
    }
    const tally=await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM gallery_hearts WHERE photo_id=?"
    ).bind(id).first();
    return json({ok:true,id,liked:data.liked,heart_count:Number(tally?.n||0)},
      200,data.liked&&!existing?heartCookie(token):null);
  }catch(e){
    console.error("Gallery heart update failed",e?.name||"Error");
    return json({error:"Could not update heart. Try again."},503);
  }
}
