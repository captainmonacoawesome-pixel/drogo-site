# Ask Meow Anything — rollout checklist

**Status:** feature branch / draft PR. Do not merge until private administration is protected.

The production website remains static until this PR is merged. Pages Functions are legitimate, version-controlled backend code (not an unsolicited wildcard Worker).

## Cloudflare resources (free-tier friendly)

1. Create D1 database `drogo-ama`.
2. Apply `db/001_ama.sql` through D1 Console (or `npx wrangler d1 execute drogo-ama --remote --file=db/001_ama.sql` from a checkout). Schema creates pending/public questions and a hashed-IP rate-limit table.
3. In **Compute → Workers & Pages → drogo-site → Settings → Bindings**, add D1 binding named **DB** to database `drogo-ama`. Configure **Preview and Production** bindings separately as needed. **Avoid pointing a public preview at production data**; ideally create `drogo-ama-preview` with the same schema for preview.
4. Create a Turnstile widget in Cloudflare for the Drogo site and chosen Pages preview host. Add `TURNSTILE_SITE_KEY` (plain text variable) and `TURNSTILE_SECRET` (encrypted secret) to Pages environment settings.
5. Generate a new 32+ byte random string and store as encrypted Pages secret `RATE_LIMIT_PEPPER`. Do not put the pepper, Turnstile secret, or Access credentials in GitHub.
6. Configure **Cloudflare Access** applications to protect **both** `/admin/*` and `/api/ama/admin` on the custom domain and any preview domain used. Allow only your and your wife's verified identities. Pages domain is an alternate way to reach the site: do not rely on a custom-domain Access rule alone.
7. Set Pages encrypted configuration `ACCESS_TEAM_DOMAIN` (e.g. `your-team.cloudflareaccess.com`) and `ACCESS_AUD` (the Access application AUD tag for the **API admin route**). Both required. Server cryptographically verifies the signed Access JWT, its issuer, audience and expiry; no backend moderation without it. If Access uses distinct AUD tags for admin UI and admin API, use the API application's AUD.
8. Redeploy the branch in Cloudflare Pages. Check `/api/ama/config` responds with `enabled:true`. Test Turnstile submission, moderation from `/admin/ama/`, approved public display, input escaping, rate limit and bypass attempts; confirm malicious HTML is only text.
9. Update the site-wide security policy only via reviewed `_headers` changes. Specific Ask page policy allows Turnstile. Keep all other pages' strict CSP intact.
10. After tests, merge the PR and confirm production bindings, Access protection and published experience.

## Abuse/security model

- Public can read *published* questions only; all submissions begin `pending`.
- Server-side Turnstile verification checks the returned hostname.
- Server-side caps (3/hour and 10/day per keyed pseudonymous client-IP hash). No raw IP addresses are written to D1. A malicious actor with enough distinct addresses can still submit spam.
- The moderation API fails closed without valid Cloudflare Access JWT signature. No hardcoded admin password.
- JavaScript uses `textContent` rather than injecting visitor HTML into the DOM.
- API routes return `Cache-Control: no-store`, and the Pages `_routes.json` keeps static traffic off paid function invocations.
- Logs may contain Cloudflare request metadata; treat it as sensitive.
- A successfully published question is public; verify names and answers before approval.
- If Cloudflare Access is not configured, DO NOT treat the admin page as private even though the underlying API rejects unauthenticated requests.

## Coming later

- R2-based photo uploads and Cat Pic of the Day.
- Double opt-in subscriber notifications and unsubscribes.
- Optional local CatChat answer drafts **with human review**, never direct public model access.
