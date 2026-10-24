// The public Brevo-hosted double-opt-in form URL will be inserted here after setup.
// Never put API credentials or personal subscriber data into this file.
const WEEKLY_MUSH_SIGNUP_URL = "";
(() => {
  const urlText = WEEKLY_MUSH_SIGNUP_URL.trim();
  const link = document.getElementById("jerk-subscribe-link");
  const message = document.getElementById("jerk-coming-soon");
  if (!urlText || !link || !message) return;
  try {
    const url = new URL(urlText);
    if (url.protocol !== "https:") return;
    link.href = url.href;
    link.hidden = false;
    message.hidden = true;
  } catch (_) {
    // Fail closed if no valid hosted registration form is configured.
  }
})();
