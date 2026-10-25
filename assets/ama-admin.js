(() => {
  const list = document.querySelector("#ama-pending");
  const status = document.querySelector("#ama-admin-status");
  const refresh = document.querySelector("#ama-refresh");
  const el = (tag, className, content) => {
    const item = document.createElement(tag);
    if (className) item.className=className;
    if (content!==undefined) item.textContent=content;
    return item;
  };
  async function moderate(id, action, answer) {
    const response=await fetch("/api/ama/admin",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({id,action,answer})
    });
    const data=await response.json();
    if (!response.ok) throw new Error(data.error || "Could not save");
  }
  async function load() {
    status.textContent="Loading questions…";
    list.replaceChildren();
    try {
      const response=await fetch("/api/ama/admin",{cache:"no-store"});
      if (!response.ok) throw new Error(response.status===401?"Not signed in to Cloudflare Access. Secure this route and sign in first.":"Unable to load pending questions");
      const data=await response.json();
      const questions=Array.isArray(data.questions)?data.questions:[];
      status.textContent=questions.length?questions.length+" question(s) await approval.":"No questions awaiting approval.";
      for (const q of questions) {
        const card=el("article","ama-qa");
        card.append(el("p","ama-meta","From "+q.display_name));
        card.append(el("p","ama-question",q.question));
        const label=el("label","","Drogo's reply");
        const field=el("textarea","ama-answer-input");
        field.placeholder="A dignified and thoroughly unreasonable feline response...";
        field.maxLength=2200;
        label.append(field);
        card.append(label);
        const controls=el("div","ama-admin-controls");
        const publish=el("button","ama-button","Publish answer");
        const reject=el("button","ama-button ama-button-secondary","Reject question");
        publish.type=reject.type="button";
        async function act(action) {
          publish.disabled=reject.disabled=true;
          status.textContent="Saving…";
          try {await moderate(q.id,action,field.value);await load();}
          catch (error) {status.textContent=error.message;publish.disabled=reject.disabled=false;}
        }
        publish.addEventListener("click",()=>act("publish"));
        reject.addEventListener("click",()=>act("reject"));
        controls.append(publish,reject);
        card.append(controls);
        list.append(card);
      }
    }catch(error){status.textContent=error.message;}
  }
  refresh.addEventListener("click",load);
  load();
})();
