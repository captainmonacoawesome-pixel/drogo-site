// Heart reactions: a browser UUID can have one active reaction per photo.
// This is casual engagement, not tamper-proof voting; clearing storage resets identity.
const reply=(data,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
async function change(request,env,add){
  if(!env.DB)return reply({error:"Reactions unavailable"},503);
  if(request.headers.get("Origin")!==new URL(request.url).origin)
    return reply({error:"Origin rejected"},403);
  if(!(request.headers.get("Content-Type")||"").startsWith("application/json"))
    return reply({error:"JSON required"},415);
  let data;
  try{
    const raw=await request.text();
    if(raw.length>500)return reply({error:"Request too large"},413);
    data=JSON.parse(raw);
  }catch(_){return reply({error:"Invalid JSON"},400);}
  const id=typeof data?.id==="string"?data.id:"";
  const visitor=typeof data?.visitor_id==="string"?data.visitor_id:"";
  if(!uuid.test(id)||!uuid.test(visitor))return reply({error:"Invalid reaction"},400);
  try{
    const photo=await env.DB.prepare("SELECT id FROM gallery_photos WHERE id=?").bind(id).first();
    if(!photo)return reply({error:"Photo not found"},404);
    if(add){
      await env.DB.prepare(
        "INSERT OR IGNORE INTO gallery_likes(photo_id,visitor_id,created_at) VALUES(?,?,?)"
      ).bind(id,visitor,new Date().toISOString()).run();
    }else{
      await env.DB.prepare("DELETE FROM gallery_likes WHERE photo_id=? AND visitor_id=?")
        .bind(id,visitor).run();
    }
    const row=await env.DB.prepare(
      "SELECT COUNT(*) AS like_count FROM gallery_likes WHERE photo_id=?"
    ).bind(id).first();
    return reply({ok:true,id,like_count:Number(row?.like_count)||0,viewer_liked:add});
  }catch(err){
    console.error("Gallery reaction failed",err);
    return reply({error:"Could not save reaction. Please try again."},503);
  }
}
export function onRequestPost({request,env}){return change(request,env,true);}
export function onRequestDelete({request,env}){return change(request,env,false);}
