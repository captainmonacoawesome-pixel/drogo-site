// Public Brevo-hosted double-opt-in signup form for The Weekly Mush.
// Never put API credentials or personal subscriber data into this file.
const WEEKLY_MUSH_SIGNUP_URL = "https://1621b687.sibforms.com/serve/MUIFAIRFBDPOlMVcJh0lqT-Js6d6f8fjSdsAw5UkWHoo1HGMpg6cJyXB_ZjWxP81vVMvKCbPY7vVD1GqTJKpyJZnJSMzBC9TNdPammVXLFKYKTCxe_-UW-WmI_2MZmau1IE_W1urr4jfU0ikYZ0TZkd9EMzv7Kpqnwthu0I6uwmB8xQSTXk-GqXUtlhftoiDC1Tu9YkCrUdkzRt4Uw==";
(() => {
  const urlText = WEEKLY_MUSH_SIGNUP_URL.trim();
  const link = document.getElementById("jerk-subscribe-link");
  const message = document.getElementById("jerk-coming-soon");
  if (!urlText || !link || !message) return;
  try {
    const url = new URL(urlText);
    if (url.protocol !== "https:" || !/^[a-z0-9-]+\.sibforms\.com$/.test(url.hostname)) return;
    link.href = url.href;
    link.hidden = false;
    message.hidden = true;
  } catch (_) {
    // Fail closed if no valid hosted registration form is configured.
  }
})();
