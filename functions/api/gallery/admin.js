// Staff-only image uploads and featured-photo selection.
// Cloudflare Access protects preview host; JWT signature ALSO verified here.
function out(data,status=200){return Response.json(data,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}})}
function b64url(s){return Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(s.length/4)*4,"=")),c=>c.charCodeAt(0))}
async function access(request,env){
  const domain=env.ACCESS_TEAM_DOMAIN, aud=env.ACCESS_AUD;
  if(!domain||!aud||!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain))return false;
  const token=request.headers.get("Cf-Access-Jwt-Assertion")||"";
  const parts=token.split(".");
  if(parts.length!==3)return false;
  let header,claims;
  try{header=JSON.parse(new TextDecoder().decode(b64url(parts[0])));claims=JSON.parse(new TextDecoder().decode(b64url(parts[1])))}
  catch(_){return false}
  const now=Math.floor(Date.now()/1000);
  if(header.alg!=="RS256"||!header.kid||claims.iss!=="https://"+domain||
     !(typeof claims.aud==="string"||Array.isArray(claims.aud))||
     !(Array.isArray(claims.aud)?claims.aud.includes(aud):claims.aud===aud)||
     !Number.isFinite(claims.exp)||claims.exp<=now||
     (claims.nbf&&claims.nbf>now))return false;
  try{
    const r=await fetch("https://"+domain+"/cdn-cgi/access/certs",{cf:{cacheTtl:3600,cacheEverything:true}});
    if(!r.ok)return false;
    const {keys}=await r.json();
    const k=Array.isArray(keys)&&keys.find(x=>x.kid===header.kid&&x.kty==="RSA");
    if(!k)return false;
    const pub=await crypto.subtle.importKey("jwk",k,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
    return crypto.subtle.verify("RSASSA-PKCS1-v1_5",pub,b64url(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1]));
  }catch(e){console.error("Access verification failed",e);return false}
}
async function guard(request,env){
  if(!await access(request,env))return out({error:"Staff sign-in required"},401);
  if(!env.DB||!env.PHOTOS)return out({error:"Gallery not configured"},503);
  if(request.method!=="GET"&&request.headers.get("Origin")!==new URL(request.url).origin)
    return out({error:"Origin rejected"},403);
  return null;
}
export async function onRequestGet({request,env}){
  const error=await guard(request,env);if(error)return error;
  try{
    const r=await env.DB.prepare("SELECT id,caption,created_at,is_photo_of_day FROM gallery_photos ORDER BY created_at DESC LIMIT 100").all();
    return out({photos:r.results||[]});
  }catch(e){console.error(e);return out({error:"Unable to load photos"},503)}
}
export async function onRequestPost({request,env}){
  const error=await guard(request,env);if(error)return error;
  if(!(request.headers.get("Content-Type")||"").startsWith("multipart/form-data"))
    return out({error:"Expected a photo upload"},415);
  const length=Number(request.headers.get("Content-Length")||0);
  if(length>6*1024*1024)return out({error:"Photo exceeds 6 MB"},413);
  let form;
  try{form=await request.formData()}catch(_){return out({error:"Invalid upload"},400)}
  const photo=form.get("photo");
  const caption=String(form.get("caption")||"").trim();
  const featured=form.get("featured")==="true";
  if(!photo||typeof photo.arrayBuffer!=="function"||photo.type!=="image/jpeg")
    return out({error:"Upload a JPEG photo"},415);
  if(photo.size<300||photo.size>5*1024*1024)
    return out({error:"Photo must be under 5 MB"},413);
  if(caption.length>300)return out({error:"Caption must be under 300 characters"},400);
  const bytes=new Uint8Array(await photo.arrayBuffer());
  if(bytes[0]!==0xff||bytes[1]!==0xd8||bytes[2]!==0xff)
    return out({error:"Invalid JPEG image"},415);
  const id=crypto.randomUUID(), key="photos/"+id+".jpg",now=new Date().toISOString();
  try{
    await env.PHOTOS.put(key,bytes,{httpMetadata:{contentType:"image/jpeg"}});
    try{
      if(featured){
        await env.DB.batch([
          env.DB.prepare("UPDATE gallery_photos SET is_photo_of_day=0 WHERE is_photo_of_day=1"),
          env.DB.prepare("INSERT INTO gallery_photos(id,object_key,caption,created_at,is_photo_of_day) VALUES(?,?,?,?,1)")
            .bind(id,key,caption,now)
        ]);
      }else{
        await env.DB.prepare("INSERT INTO gallery_photos(id,object_key,caption,created_at) VALUES(?,?,?,?)")
          .bind(id,key,caption,now).run();
      }
    }catch(e){await env.PHOTOS.delete(key);throw e}
    return out({ok:true,id,featured},201);
  }catch(e){console.error("Upload failed",e);return out({error:"Could not publish photo"},503)}
}
export async function onRequestPatch({request,env}){
  const error=await guard(request,env);if(error)return error;
  if(!(request.headers.get("Content-Type")||"").startsWith("application/json"))
    return out({error:"JSON required"},415);
  let body;try{const raw=await request.text();if(raw.length>1000) return out({error:"Too large"},413);body=JSON.parse(raw)}
  catch(_){return out({error:"Invalid JSON"},400)}
  const id=String(body.id||"");
  if(!/^[0-9a-f-]{36}$/.test(id)||body.action!=="feature")return out({error:"Invalid request"},400);
  try{
    const p=await env.DB.prepare("SELECT id FROM gallery_photos WHERE id=?").bind(id).first();
    if(!p)return out({error:"Photo not found"},404);
    await env.DB.batch([
      env.DB.prepare("UPDATE gallery_photos SET is_photo_of_day=0 WHERE is_photo_of_day=1"),
      env.DB.prepare("UPDATE gallery_photos SET is_photo_of_day=1 WHERE id=?").bind(id)
    ]);
    return out({ok:true});
  }catch(e){console.error(e);return out({error:"Unable to feature photo"},503)}
}
