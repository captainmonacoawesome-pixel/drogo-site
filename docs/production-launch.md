# Production launch runbook — Drogo Protocol 2.0

**Production homepage:** `https://drogo.carmensandiego666.xyz/`
**GitHub branch:** `feature/drogo-2-ama` → `main`. Do not merge until all gated dependencies are ready.

## Security and launch model

- Public: `/`, `/ask-meow-anything/`, `/cat-pics/`, `/weekly-mush/`, public AMA and gallery APIs.
- Staff only: `/admin/ama/`, `/admin/gallery/`, `/api/ama/admin`, `/api/gallery/admin`.
- The Pages Function `functions/admin/[[path]].js` validates a signed Cloudflare Access JWT before delivering *any* `/admin/*` HTML, including via `pages.dev`. This is defence-in-depth for hostname bypass; never rely on it alone. Admin APIs also verify JWT signature.
- Access applications must protect admin HTML and admin APIs. They must not protect the site's public root.
- Lock down who is allowed: only the site's owner and Alicia. Use one Access application with the same AUD for all *production* admin paths, or ensure that all admin/API applications issue the single `ACCESS_AUD` configured for Pages; otherwise admin requests fail.
- Ensure your Pages project Functions **Fail closed** on exhaustion so authentication is not bypassed.
- No previous malicious wildcard Worker route should be restored. Keep the Cloudflare audit watchdog running.

## Production resources (keep preview separate)

1. Create D1 database `drogo-ama`. Run **both** `db/001_ama.sql` and `db/002_gallery.sql` against that database.
2. Create a **private** R2 bucket `drogo-gallery` with no public development domain and no attached public domain.
3. Pages project `drogo-site` → **Production** environment → Bindings:
   - D1 database binding **`DB`** → `drogo-ama`
   - R2 bucket binding **`PHOTOS`** → `drogo-gallery`
   Use the exact uppercase binding variable names.
4. Pages → **Production** → Variables/Secrets:
   - `TURNSTILE_SITE_KEY`: public key from a Cloudflare Turnstile widget permitting `drogo.carmensandiego666.xyz`.
   - `TURNSTILE_SECRET`: the matching Turnstile secret, encrypted.
   - `RATE_LIMIT_PEPPER`: new random ≥32-byte secret, encrypted.
   - `ACCESS_TEAM_DOMAIN`: `shapemasters.cloudflareaccess.com` (check still correct).
   - `ACCESS_AUD`: application AUD tag for the **production admin Access application**.
   None of these belong in the repository.
5. Zero Trust → Access → Applications: create a **self-hosted** Access application restricted to owner's and Alicia's email addresses, matching **only**:
   - `drogo.carmensandiego666.xyz/admin/*`
   - `drogo.carmensandiego666.xyz/api/ama/admin`
   - `drogo.carmensandiego666.xyz/api/gallery/admin`
   If the UI creates separate applications with separate AUD values, consolidate paths into one application. Use the AUD tag in Production `ACCESS_AUD`. Keep public paths unrestricted.
6. Existing preview remains protected, and production admin routes require JWT even via `drogo-site.pages.dev` because of the code-side check. Avoid creating a broad Access application on `drogo.carmensandiego666.xyz/*` as that would lock out public visitors.
7. Verify **Preview** admin pages still load after the route hardening commit. From a browser without a valid Access session, the admin must not load. Verify the corresponding `/api/.../admin` routes reject unauthorized visitors.
8. Once Production resources are ready and Preview smoke tests pass, merge PR #2 (this automatically deploys `main` through Pages). Check production deployment success.
9. Public checks:
   - `/weekly-mush/` signup opens Brevo and double opt-in succeeds;
   - `/api/ama/config` returns `enabled: true`;
   - `/ask-meow-anything/` loads Turnstile on the **production** hostname; submit a test question and moderate;
   - `/api/gallery` returns JSON, `/cat-pics/` loads; upload a photo from staff-only `/admin/gallery/`, confirm photo and featured display;
   - Validate CSP/headers and ensure no fake Cloudflare verification/Run dialog.
10. Production DB/R2 start empty; manually re-publish approved preview questions and re-upload selected photos after launch. Do **not** attach production website to the preview DB or R2 bucket.
11. Keep The Weekly Mush Issue #001 in Brevo as a draft until the public website and links are verified. Then send test campaign before first public send.
12. After go-live, monitor Cloudflare Events, site API errors, Access activity, and the watchdog. Roll back the Pages deployment if issues occur.

## Notes
- Admin access is distinct from Cloudflare dashboard rights: Alicia needs only an allowed Access email, not a Cloudflare account.
- Email Routing and Brevo domain authentication are already configured, and newsletter signup is managed by Brevo rather than D1.
- Pages Function route selection `_routes.json` includes `/api/*` and `/admin/*`, leaving ordinary static site requests on free static assets.
