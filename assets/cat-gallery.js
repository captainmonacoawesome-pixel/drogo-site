// Read-only public gallery. Untrusted captions are rendered as plain text.
(() => {
  const grid=document.querySelector("#cat-gallery-grid");
  const count=document.querySelector("#cat-gallery-count");
  const daily=document.querySelector("#cat-daily");
  const dailyImage=document.querySelector("#cat-daily-image");
  const dailyCaption=document.querySelector("#cat-daily-caption");
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
    return fig;
  }
  async function load(){
    try{
      const response=await fetch("/api/gallery",{cache:"no-store"});
      if(!response.ok)throw new Error();
      const {photos}=await response.json();
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
      if(featured){
        daily.hidden=false;
        dailyImage.src=featured.image_url;
        dailyImage.alt=featured.caption||"Cat Pic of the Day";
        dailyCaption.textContent=featured.caption||"Today's royal portrait.";
      }
    }catch(_){
      grid.textContent="The royal portrait collection is temporarily unavailable.";
      count.textContent="—";
    }
  }
  load();
})();
