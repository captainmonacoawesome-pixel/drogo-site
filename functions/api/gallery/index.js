// Public list. Images remain in private R2; only their IDs and metadata are exposed.
const reply=(data,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const visitorPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export async function onRequestGet({request,env}){
  if(!env.DB||!env.PHOTOS)return reply({photos:[],message:"Gallery coming soon"},503);
  const header=request.headers.get("X-Gallery-Visitor")||"";
  const visitor=visitorPattern.test(header)?header:"";
  try{
    let rows,reactionsEnabled=true;
    try{
      const result=await env.DB.prepare(
        "SELECT p.id,p.caption,p.created_at,p.is_photo_of_day,"+
        "(SELECT COUNT(*) FROM gallery_likes AS l WHERE l.photo_id=p.id) AS like_count,"+
        "EXISTS(SELECT 1 FROM gallery_likes AS mine WHERE mine.photo_id=p.id AND mine.visitor_id=?) AS viewer_liked "+
        "FROM gallery_photos AS p ORDER BY p.created_at DESC LIMIT 100"
      ).bind(visitor).all();
      rows=result.results||[];
    }catch(err){
      // Do not break public gallery views until db/003_gallery_likes.sql is applied.
      if(!/no such table:\s*gallery_likes/i.test(String(err.message||err)))throw err;
      reactionsEnabled=false;
      const fallback=await env.DB.prepare(
        "SELECT id,caption,created_at,is_photo_of_day FROM gallery_photos ORDER BY created_at DESC LIMIT 100"
      ).all();
      rows=fallback.results||[];
    }
    return reply({reactions_enabled:reactionsEnabled,photos:rows.map(p=>({
      id:p.id,caption:p.caption,created_at:p.created_at,
      is_photo_of_day:p.is_photo_of_day===1,
      image_url:"/api/gallery/image/"+encodeURIComponent(p.id),
      like_count:Number(p.like_count)||0,viewer_liked:p.viewer_liked===1
    }))});
  }catch(err){console.error("Gallery list failed",err);return reply({error:"Gallery temporarily unavailable"},503);}
}
