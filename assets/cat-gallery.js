// Public gallery. Captions render as text; reactions are scoped to this browser.
(() => {
  const grid=document.querySelector("#cat-gallery-grid");
  const count=document.querySelector("#cat-gallery-count");
  const daily=document.querySelector("#cat-daily");
  const dailyImage=document.querySelector("#cat-daily-image");
  const dailyCaption=document.querySelector("#cat-daily-caption");
  const status=document.querySelector("#cat-reaction-status");
  let sending=false;
  let heartsAvailable=true;
  function allHeartButtons(){
    return Array.from(document.querySelectorAll(".cat-heart-button"));
  }
  function updateHearts(id,liked,total){
    for(const b of allHeartButtons()){
      if(b.dataset.photoId!==id)continue;
      b.classList.toggle("is-liked",liked);
      b.setAttribute("aria-pressed",String(liked));
      b.setAttribute("aria-label",(liked?"Remove your heart from":"Give a heart to")+
        " this photo. "+total+" hearts.");
      b.title=liked?"Remove your heart":"Give this photo a heart";
      b.querySelector(".cat-heart-count").textContent=String(total);
    }
  }
  async function changeHeart(photo){
    if(sending)return;
    sending=true;
    for(const b of allHeartButtons())b.disabled=true;
    status.textContent="";
    const next=!photo.hearted;
    try{
      const response=await fetch("/api/gallery/heart",{
        method:"POST",
        credentials:"same-origin",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({id:photo.id,liked:next})
      });
      const body=(response.headers.get("content-type")||"").includes("application/json")?
        await response.json():null;
      if(!response.ok||!body?.ok)throw new Error(body?.error||
        "Hearts are temporarily unavailable (HTTP "+response.status+")");
      photo.hearted=Boolean(body.liked);
      photo.heart_count=Number(body.heart_count)||0;
      updateHearts(photo.id,photo.hearted,photo.heart_count);
    }catch(e){
      status.textContent=e.message||"Unable to save your heart; try again.";
    }finally{
      sending=false;
      for(const b of allHeartButtons())b.disabled=false;
    }
  }
  function heartControl(photo){
    const row=document.createElement("div");
    row.className="cat-heart-row";
    const button=document.createElement("button");
    button.type="button";
    button.className="cat-heart-button";
    button.dataset.photoId=photo.id;
    const heart=document.createElementNS("http://www.w3.org/2000/svg","svg");
    heart.setAttribute("viewBox","0 0 24 24");
    heart.setAttribute("width","21");
    heart.setAttribute("height","21");
    heart.setAttribute("aria-hidden","true");
    heart.setAttribute("fill","currentColor");
    const path=document.createElementNS("http://www.w3.org/2000/svg","path");
    path.setAttribute("d","M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z");
    heart.append(path);
    const total=document.createElement("span");
    total.className="cat-heart-count";
    button.append(heart,total);
    button.addEventListener("click",()=>changeHeart(photo));
    row.append(button);
    return row;
  }
  function photoCard(photo){
    const fig=document.createElement("figure");
    fig.className="cat-photo-card";
    const img=document.createElement("img");
    img.src=photo.image_url;
    img.alt=photo.caption||"A photograph of Drogo";
    img.loading="lazy";img.decoding="async";
    const caption=document.createElement("figcaption");
    caption.textContent=photo.caption||"His Lordship declined to provide a caption.";
    if(photo.is_photo_of_day){
      const badge=document.createElement("span");
      badge.className="cat-photo-badge";
      badge.textContent="✦ CAT PIC OF THE DAY";
      caption.append(document.createElement("br"),badge);
    }
    fig.append(img,caption);
    if(heartsAvailable)fig.append(heartControl(photo));
    return fig;
  }
  async function load(){
    try{
      const response=await fetch("/api/gallery",{cache:"no-store",credentials:"same-origin"});
      if(!response.ok)throw new Error("Gallery unavailable");
      const result=await response.json();
      const {photos}=result;
      heartsAvailable=result.hearts_available!==false;
      status.textContent=heartsAvailable?"":"Heart reactions are temporarily unavailable. The photographs are still here.";
      const items=Array.isArray(photos)?photos:[];
      grid.replaceChildren();
      count.textContent=items.length+" photos";
      if(!items.length){
        const p=document.createElement("p");
        p.className="muted";
        p.textContent="The royal portrait collection is being assembled. Check back soon.";
        grid.append(p);
      }
      for(const item of items)grid.append(photoCard(item));
      const featured=items.find(p=>p.is_photo_of_day);
      daily.querySelector(".cat-heart-row")?.remove();
      if(featured){
        daily.hidden=false;
        dailyImage.src=featured.image_url;
        dailyImage.alt=featured.caption||"Cat Pic of the Day";
        dailyCaption.textContent=featured.caption||"Today's royal portrait.";
        if(heartsAvailable)daily.querySelector("figure").append(heartControl(featured));
      }else{
        daily.hidden=true;
      }
      // The featured picture also appears in the grid; keep both in sync.
      if(heartsAvailable)for(const p of items)updateHearts(p.id,Boolean(p.hearted),Number(p.heart_count)||0);
    }catch(_){
      grid.textContent="The royal portrait collection is temporarily unavailable.";
      count.textContent="—";
    }
  }
  load();
})();
