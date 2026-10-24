(() => {
  const form=document.querySelector("#cat-upload");
  const fileInput=document.querySelector("#cat-file");
  const preview=document.querySelector("#cat-upload-preview");
  const status=document.querySelector("#cat-upload-status");
  const button=document.querySelector("#cat-upload-button");
  const list=document.querySelector("#cat-admin-grid");
  const adminStatus=document.querySelector("#cat-admin-status");
  let previewUrl=null;
  function clearPreview(){
    if(previewUrl)URL.revokeObjectURL(previewUrl);
    previewUrl=null;preview.hidden=true;preview.removeAttribute("src");
  }
  fileInput.addEventListener("change",()=>{
    clearPreview();
    const file=fileInput.files?.[0];
    if(file){
      previewUrl=URL.createObjectURL(file);
      preview.src=previewUrl;preview.hidden=false;
    }
  });
  async function toJpeg(file){
    if(!file||!file.type.startsWith("image/"))throw new Error("Choose an image from your Photos library.");
    const url=URL.createObjectURL(file);
    try{
      const img=new Image();
      await new Promise((resolve,reject)=>{
        img.onload=resolve;img.onerror=()=>reject(new Error("This photo format could not be opened. Try a JPEG."));
        img.src=url;
      });
      const width=img.naturalWidth,height=img.naturalHeight;
      if(!width||!height)throw new Error("Photo could not be decoded.");
      const scale=Math.min(1,1600/Math.max(width,height));
      const canvas=document.createElement("canvas");
      canvas.width=Math.max(1,Math.round(width*scale));
      canvas.height=Math.max(1,Math.round(height*scale));
      const context=canvas.getContext("2d");
      if(!context)throw new Error("Unable to prepare image.");
      context.drawImage(img,0,0,canvas.width,canvas.height);
      // JPEG re-encoding through canvas normally removes embedded GPS/EXIF metadata.
      const output=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",0.82));
      if(!output)throw new Error("Unable to convert image to JPEG.");
      if(output.size>5*1024*1024)throw new Error("Photo too large after resizing; please choose another.");
      return new File([output],"drogo.jpg",{type:"image/jpeg"});
    } finally{URL.revokeObjectURL(url);}
  }
  async function refresh(){
    adminStatus.textContent="Loading published portraits…";
    list.replaceChildren();
    try{
      const r=await fetch("/api/gallery/admin",{cache:"no-store"});
      const isJson=(r.headers.get("content-type")||"").includes("application/json");
      const data=isJson?await r.json():null;
      if(!r.ok) {
        const message=data?.error||(
          r.status===401||r.status===403?
          "Staff authentication was rejected. Please sign in through Cloudflare Access.":
          "Gallery API returned HTTP "+r.status+"."
        );
        throw new Error(message+" (HTTP "+r.status+")");
      }
      if(!data)throw new Error("Gallery API returned an unexpected response rather than JSON.");
      const photos=Array.isArray(data.photos)?data.photos:[];
      adminStatus.textContent=photos.length+" published photograph(s)";
      if(!photos.length)adminStatus.textContent="No photographs published yet.";
      for(const photo of photos){
        const card=document.createElement("figure");card.className="cat-photo-card";
        const image=document.createElement("img");
        image.src="/api/gallery/image/"+encodeURIComponent(photo.id);
        image.alt=photo.caption||"Drogo";image.loading="lazy";
        const caption=document.createElement("figcaption");
        caption.textContent=photo.caption||"His Lordship declined to comment.";
        card.append(image,caption);
        if(photo.is_photo_of_day===1){
          const marker=document.createElement("p");marker.className="cat-photo-badge";
          marker.textContent="✦ CURRENT DAILY PHOTO";card.append(marker);
        }else{
          const feature=document.createElement("button");
          feature.type="button";feature.textContent="Feature today";
          feature.addEventListener("click",async()=>{
            feature.disabled=true;
            try{
              const r=await fetch("/api/gallery/admin",{
                method:"PATCH",headers:{"Content-Type":"application/json"},
                body:JSON.stringify({id:photo.id,action:"feature"})
              });
              const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to feature");
              await refresh();
            }catch(e){adminStatus.textContent=e.message;feature.disabled=false;}
          });
          card.append(feature);
        }
        list.append(card);
      }
    }catch(e){adminStatus.textContent=e.message;}
  }
  form.addEventListener("submit",async event=>{
    event.preventDefault();
    if(!fileInput.files?.length)return;
    button.disabled=true;status.textContent="Preparing photo for upload…";
    try{
      const jpeg=await toJpeg(fileInput.files[0]);
      const data=new FormData();
      data.append("photo",jpeg);
      data.append("caption",document.querySelector("#cat-caption").value.trim());
      data.append("featured",document.querySelector("#cat-feature").checked?"true":"false");
      status.textContent="Publishing your photograph…";
      const r=await fetch("/api/gallery/admin",{method:"POST",body:data});
      const response=(r.headers.get("content-type")||"").includes("application/json")?await r.json():null;
      if(!r.ok)throw new Error((response?.error||"Publishing failed")+" (HTTP "+r.status+")");
      if(!response)throw new Error("Upload API returned an unexpected response.");
      status.textContent="Published! Lord Squeak's admirers can now see this photo.";
      form.reset();clearPreview();await refresh();
    }catch(e){status.textContent=e.message||"Upload failed. Please retry."}
    finally{button.disabled=false}
  });
  refresh();
})();
