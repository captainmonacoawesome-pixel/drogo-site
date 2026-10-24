# AMA pending-question push alerts

On every **successful** public AMA question submission, the Pages Function sends
a generic ntfy notification with a click-through to the Access-protected
`/admin/ama/` page. The question and submitter's name are **not** sent to ntfy.

## Setup

1. In the ntfy app on your phone, subscribe to a **new, hard-to-guess topic**
   (16 to 64 characters, letters/numbers/dashes/underscores only).
   Use `openssl rand -hex 16` on Ripper for a safe random topic name.
2. Build its HTTPS publishing URL `https://ntfy.sh/YOUR_RANDOM_TOPIC`.
   Do not put the real topic in GitHub or public conversation.
3. In Cloudflare `drogo-site` → **Production** → Variables and secrets,
   add an **encrypted secret** named `AMA_NTFY_URL` with the URL as the value.
   If you also want Preview alerts, configure a *separate* secret/topic on Preview.
4. Merge this PR to `main` and verify the production deployment succeeds.
5. Submit a test AMA question on the public site, pass Turnstile, and verify
   the phone receives an alert. Tap it to open the private moderator page
   behind Cloudflare Access.

## Behaviour and safety

- The notification is posted asynchronously using Pages `waitUntil` once
  the D1 transaction has committed; failed notifications do not invalidate
  successful questions. No notification on honeypot, invalid Turnstile,
  rate-limited submissions or database failures.
- Push is **optional**: without `AMA_NTFY_URL`, questions continue working
  normally but no alerts are sent.
- Restricted to `https://ntfy.sh/<topic>` with 16–64 safe characters.
  No arbitrary URLs or redirects by configuration. Never expose the topic
  or link in source code.
- Notification body and title are fixed, containing **no visitor input**.
  A click-through URL goes to the existing staff-only admin page.
- Existing pending questions from **before deployment** will not trigger
  retrospective notifications; check those once manually in admin.
- ntfy topics are not inherently private. Keep topic names unguessable,
  and note that anyone who obtains the topic URL can generally publish to
  or subscribe to it unless additional ntfy authentication is configured.
- The existing 3/hour and 10/day per-client rate limits still apply; a
  distributed spam source may still create multiple notifications.
- No new Cloudflare Worker routes, cron jobs, or inbound access to Ripper.
