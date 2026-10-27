// Public photo gallery: captions are always rendered as text, never HTML.
(()=>{
 const grid=document.querySelector("#cat-gallery-grid"),count=document.querySelector("#cat-gallery-count");
 const daily=document.querySelector("#cat-daily"),dailyImage=document.querySelector("#cat-daily-image"),dailyCaption=document.querySelector("#cat-daily-caption");
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
 const visitorId=(()=>{
   try{const key="drogo-gallery-visitor-v1",saved=localStorage.getItem(key);
     if(uuid.test(saved||""))return saved;
     const id=crypto.randomUUID();localStorage.setItem(key,id);return id;
   }catch(_){return crypto.randomUUID();}
 })();
 function buttonsFor(id){return [...document.querySelectorAll(".cat-heart")].filter(b=>b.dataset.photoId===id);}
 function sync(id,likes,liked){
   for(const b of buttonsFor(id)){
     b.setAttribute("aria-pressed",String(Boolean(liked)));
     b.setAttribute("aria-label",(liked?"Remove your heart":"Give this photo a heart")+" ("+likes+" hearts)");
     b.querySelector(".cat-heart-count").textContent=String(likes);
   }
 }
 function heartButton(photo){
   const row=document.createElement("div");row.className="cat-heart-row";
   const b=document.createElement("button");b.type="button";b.className="cat-heart";b.dataset.photoId=photo.id;
   const icon=document.createElement("span");icon.textContent="♥";icon.className="cat-heart-icon";icon.setAttribute("aria-hidden","true");
   const n=document.createElement("span");n.className="cat-heart-count";b.append(icon,n);
   const msg=document.createElement("span");msg.className="cat-heart-message";msg.setAttribute("role","status");
   row.append(b,msg);
   b.setAttribute("aria-pressed",String(Boolean(photo.viewer_liked)));
   b.setAttribute("aria-label",(photo.viewer_liked?"Remove your heart":"Give this photo a heart")+" ("+(Number(photo.like_count)||0)+" hearts)");
   n.textContent=String(Number(photo.like_count)||0);
   b.addEventListener("click",async()=>{
     const liked=b.getAttribute("aria-pressed")==="true",all=buttonsFor(photo.id);
     for(const other of all){other.disabled=true;other.parentElement.querySelector(".cat-heart-message").textContent="";}
     try{
       const response=await fetch("/api/gallery/likes",{
         method:liked?"DELETE":"POST",headers:{"Content-Type":"application/json"},
         body:JSON.stringify({id:photo.id,visitor_id:visitorId})
       });
       const result=await response.json();
       if(!response.ok||!result.ok)throw new Error(result.error||"Could not save heart");
       sync(photo.id,result.like_count,result.viewer_liked);
     }catch(err){msg.textContent=err.message||"Could not save heart. Try again.";}
     finally{for(const other of all)other.disabled=false;}
   });
   return row;
 }
 function card(photo,heartsEnabled){
   const fig=document.createElement("figure");fig.className="cat-photo-card";
   const img=document.createElement("img");img.src=photo.image_url;img.alt=photo.caption||"A photograph of Drogo";
   img.loading="lazy";img.decoding="async";
   const caption=document.createElement("figcaption");
   caption.textContent=photo.caption||"His Lordship declined to provide a caption.";
   if(photo.is_photo_of_day){
     const badge=document.createElement("span");badge.className="cat-photo-badge";
     badge.textContent="✦ CAT PIC OF THE DAY";caption.append(document.createElement("br"),badge);
   }
   if(heartsEnabled)caption.append(heartButton(photo));
   fig.append(img,caption);return fig;
 }
 async function load(){
   try{
     const response=await fetch("/api/gallery",{cache:"no-store",headers:{"X-Gallery-Visitor":visitorId}});
     if(!response.ok)throw new Error("Gallery unavailable");
     const data=await response.json(),photos=Array.isArray(data.photos)?data.photos:[],enabled=data.reactions_enabled===true;
     grid.replaceChildren();count.textContent=photos.length+" photos";
     if(!photos.length){const p=document.createElement("p");p.className="muted";p.textContent="The royal portrait collection is being assembled. Check back soon.";grid.append(p);}
     for(const photo of photos)grid.append(card(photo,enabled));
     const featured=photos.find(p=>p.is_photo_of_day);daily.hidden=!featured;
     if(featured){
       dailyImage.src=featured.image_url;dailyImage.alt=featured.caption||"Cat Pic of the Day";
       dailyCaption.textContent=featured.caption||"Today's royal portrait.";
       if(enabled)dailyCaption.append(heartButton(featured));
     }
   }catch(_){daily.hidden=true;grid.textContent="The royal portrait collection is temporarily unavailable.";count.textContent="—";}
 }
 load();
})();
