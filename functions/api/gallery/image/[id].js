// Serve only objects present in the published gallery database.
export async function onRequestGet({params,env}) {
  if (!env.DB || !env.PHOTOS) return new Response("Gallery unavailable",{status:503});
  const id=String(params.id||"");
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(id)) return new Response("Not found",{status:404});
  try {
    const p=await env.DB.prepare("SELECT object_key FROM gallery_photos WHERE id=?").bind(id).first();
    if (!p) return new Response("Not found",{status:404});
    const object=await env.PHOTOS.get(p.object_key);
    if (!object) return new Response("Not found",{status:404});
    return new Response(object.body,{headers:{
      "Content-Type":"image/jpeg",
      "Content-Disposition":"inline",
      "Cache-Control":"public, max-age=3600",
      "X-Content-Type-Options":"nosniff"
    }});
  }catch(e){console.error("Gallery image failed",e);return new Response("Image unavailable",{status:503});}
}
