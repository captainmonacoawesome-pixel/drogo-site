// Public list; only metadata and IDs are exposed (R2 remains private).
const response = (body,status=200) => Response.json(body,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
export async function onRequestGet({env}) {
  if (!env.DB || !env.PHOTOS) return response({photos:[],message:"Gallery coming soon"},503);
  try {
    const q=await env.DB.prepare(
      "SELECT id, caption, created_at, is_photo_of_day FROM gallery_photos ORDER BY created_at DESC LIMIT 100"
    ).all();
    return response({photos:(q.results||[]).map(p=>({
      id:p.id,caption:p.caption,created_at:p.created_at,
      is_photo_of_day:p.is_photo_of_day===1,
      image_url:"/api/gallery/image/"+encodeURIComponent(p.id)
    }))});
  } catch(e){console.error("Gallery list failed",e);return response({error:"Gallery temporarily unavailable"},503);}
}
