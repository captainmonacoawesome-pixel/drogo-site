// Client-side display and submission. All moderation/security checks live on the server.
(() => {
  const list = document.querySelector("#ama-questions");
  const count = document.querySelector("#ama-count");
  const form = document.querySelector("#ama-form");
  const status = document.querySelector("#ama-status");
  const submit = document.querySelector("#ask-submit");
  const turnstileArea = document.querySelector("#turnstile-container");
  let turnstileWidget = null;
  let turnstileToken = "";
  function say(message) { status.textContent = message; }
  function element(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }
  async function loadPublished() {
    try {
      const response = await fetch("/api/ama", {cache:"no-store"});
      if (!response.ok) throw new Error("Not ready");
      const data = await response.json();
      list.replaceChildren();
      const questions = Array.isArray(data.questions) ? data.questions : [];
      count.textContent = String(questions.length);
      if (!questions.length) {
        list.append(element("p","ama-empty","The royal court has not answered any questions yet. Be the first to seek his wisdom."));
        return;
      }
      for (const q of questions) {
        const article = element("article","ama-qa");
        article.append(element("p","ama-meta","A question from " + q.display_name));
        article.append(element("p","ama-question",q.question));
        const answerRow = element("div", "ama-answer-row");
        const avatar = element("img", "ama-answer-avatar");
        avatar.src = "/assets/lord-squeak-typing.gif";
        avatar.alt = "A black and white cat typing on a laptop";
        avatar.loading = "lazy";
        avatar.width = 104;
        avatar.height = 104;
        // Hide the avatar if the image hasn't been uploaded yet.
        avatar.addEventListener("error", () => avatar.hidden = true);
        const answer = element("div","ama-answer");
        answer.append(element("strong","", "Lord Squeak replies"));
        answer.append(element("p","",q.answer || ""));
        answerRow.append(avatar, answer);
        article.append(answerRow);
        list.append(article);
      }
    } catch (_) {
      count.textContent = "—";
      list.replaceChildren(element("p","ama-empty","The feline archives are being prepared. Please check back soon."));
    }
  }
  async function configure() {
    try {
      const response = await fetch("/api/ama/config", {cache:"no-store"});
      if (!response.ok) throw new Error("Configuration unavailable");
      const config = await response.json();
      if (!config.enabled || !config.turnstileSiteKey) {
        say("The cat's correspondence desk is not open yet. Check back soon.");
        return;
      }
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = () => {
        if (!window.turnstile) { say("Verification could not load."); return; }
        turnstileWidget = window.turnstile.render(turnstileArea, {
          sitekey: config.turnstileSiteKey,
          callback: token => {turnstileToken = token; submit.disabled = false; say("The cat is accepting questions.");},
          "expired-callback": () => {turnstileToken = ""; submit.disabled = true; say("Verification expired. Please try again.");},
          "error-callback": () => {turnstileToken = ""; submit.disabled = true; say("Verification unavailable. Please retry.");}
        });
        say("Complete the verification to submit a question.");
      };
      script.onerror = () => say("Verification could not load. Please try again later.");
      document.head.append(script);
    } catch (_) { say("The cat's correspondence desk is temporarily closed."); }
  }
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!form.reportValidity() || !turnstileToken) return;
    submit.disabled = true;
    say("Delivering your message to His Majesty…");
    try {
      const response = await fetch("/api/ama", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          name: form.elements.name.value,
          question: form.elements.question.value,
          website: form.elements.website.value,
          turnstileToken
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Submission failed");
      form.reset();
      say(data.message || "Your question is awaiting approval. Thank you!");
    } catch (error) { say(error.message || "Unable to submit. Try again."); }
    finally {
      turnstileToken = "";
      if (window.turnstile && turnstileWidget !== null) window.turnstile.reset(turnstileWidget);
    }
  });
  loadPublished();
  configure();
})();
