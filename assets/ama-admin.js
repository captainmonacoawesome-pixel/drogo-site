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
  const testButton = document.querySelector("#ama-test-notification");
  const notificationStatus = document.querySelector("#ama-notification-status");
  if (testButton && notificationStatus) {
    testButton.addEventListener("click", async () => {
      testButton.disabled = true;
      notificationStatus.textContent = "Testing delivery from Cloudflare…";
      try {
        const response = await fetch("/api/ama/admin", {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          credentials:"same-origin",
          cache:"no-store",
          body:JSON.stringify({action:"test_notification"})
        });
        const contentType = response.headers.get("content-type") || "unknown";
        const raw = await response.text();
        let result;
        try {
          result = JSON.parse(raw);
        } catch (_) {
          // Access redirects, challenge pages, and runtime failures can
          // return HTML. Never display response bodies or sensitive tokens.
          const redirected = response.redirected ? " after redirect" : "";
          notificationStatus.textContent =
            "Cloudflare returned HTTP " + response.status + redirected +
            " (" + contentType.split(";")[0] +
            "), not JSON. " +
            (response.status === 401 || response.status === 403
              ? "Check Cloudflare Access for this API."
              : response.status >= 500
                ? "Check Cloudflare Pages Function runtime logs."
                : "Check Cloudflare's API request/security logs.");
          return;
        }
        if (result.reason === "missing_production_secret") {
          notificationStatus.textContent = "Cloudflare has no AMA_NTFY_URL secret in this deployment.";
        } else if (result.ok) {
          notificationStatus.textContent = "ntfy accepted the test (HTTP "+result.status+
            "). Check your phone. Topic fingerprint: "+result.topicFingerprint;
        } else {
          notificationStatus.textContent = "Cloudflare could not publish: "+
            (result.reason || result.error || "HTTP "+response.status)+
            (result.status ? " ("+result.status+")" : "")+
            (result.topicFingerprint ? ". Topic fingerprint: "+result.topicFingerprint : "");
        }
      } catch (error) {
        // Network errors (including CSP violations) are different from HTTP
        // errors and have no Response/status to inspect.
        notificationStatus.textContent =
          "Browser could not complete diagnostic request: " +
          (error && error.name === "TypeError"
            ? "network request blocked or interrupted. Check browser Console."
            : "request interrupted. Check browser Console.");
        console.warn("AMA diagnostic browser request error:", error);
      } finally {
        testButton.disabled = false;
      }
    });
  }
  load();
})();
