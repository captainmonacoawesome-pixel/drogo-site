# The Weekly Entitled Jerk — subscription launch checklist

## Chosen MVP
- Free **Brevo** marketing contacts and email campaign service.
- **Double opt-in hosted signup form**; links to the form from the Drogo site.
- Contact email addresses, suppression and unsubscribe workflows are kept in Brevo, not D1.
- Initially send a manually curated newsletter once per week from Brevo.
- No API keys, third-party JavaScript, iframe CSP relaxation or Cloudflare Worker required.
- Later optional automation can prepare and send the weekly digest, but do NOT activate any automated sending until mail sender, consent and QA are tested.

## Setup steps
1. Create a Brevo Free account, and confirm the **300 emails/day free plan limit** is adequate for early subscribers.
2. Authenticate the domain and sender address with Brevo (SPF, DKIM, DMARC records as Brevo instructs). Do not override existing DNS without reviewing it. This domain may be used for other services.
3. Create a contact list: **The Weekly Entitled Jerk — Subscribers**.
4. In Brevo **Marketing → Forms → Sign-up → Full page/embedded**, create a form named **The Weekly Entitled Jerk**.
5. Require only an email address. Enable **Double confirmation** and select that subscribers are added only after confirming via email. The subscribe form must clearly explain the weekly frequency and expected content.
6. In Brevo, use the **Share → Form URL** option (an HTTPS URL); the form can be hosted by Brevo for free and manages its own CAPTCHA and confirmation.
7. Put that exact HTTPS URL between the quotes in `assets/newsletter.js` as `WEEKLY_ENTITLED_JERK_SIGNUP_URL`. Commit on preview branch only and test the CTA link opens the correct Brevo form. Do not paste private Brevo API keys into GitHub.
8. Submit a test subscription from an external email account. Verify it remains unconfirmed until email confirmation, then is added to the right contact list.
9. In Brevo create a weekly campaign for **only the confirmed subscribers**. Include featured photo(s), links to `/cat-pics/` and `/ask-meow-anything/`, sender identity, reply-to/contact details and Brevo-managed unsubscribe link. Send a test campaign to yourself and Alicia first.
10. Before production merge: check subscriber landing page styling, signup link, live consent, sending domain DNS, privacy statement, and that the campaign excludes unsubscribed/unconfirmed contacts.
11. When ready to launch, configure production gallery and AMA bindings, protect only admin paths with production Access (not public subscriptions), then merge the feature PR. `/weekly-entitled-jerk/` will be public.

## Notes
- Brevo's free plan includes **300 sends per day**, not 300 total subscriptions.
- If the list exceeds 300 people, a weekly campaign might take multiple days, need retries, or require an upgrade. Keep a count.
- A sender must accurately identify the operator and offer a valid means of contact. Do **not** publish a private home address without considering alternatives.
- For Australian recipients, keep consent records and offer an easy unsubscribe. Brevo handles the unsubscribe mechanism for its campaigns.
- A hosted link keeps the site's restrictive Content Security Policy unchanged. No contact information is collected or processed directly by Cloudflare Pages.
- The page deliberately says "subscription desk is being prepared" until the form URL has been entered.
