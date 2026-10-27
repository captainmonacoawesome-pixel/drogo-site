# Hearts on Cat Pics

The public `/cat-pics/` page shows a heart button and count under every gallery
portrait and the featured Cat Pic of the Day. The same photograph shares one
counter across both locations.

## Anonymous, one vote per browser per photo

- No login required. A random **256-bit** identifier is first issued in a
  host-only, HttpOnly, Secure, SameSite=Lax cookie after the first heart.
- D1 stores only a keyed HMAC of that random value, never the cookie itself.
- The primary key (`photo_id`, `visitor_hash`) prevents duplicates; taps
  are idempotent and another tap removes the heart.
- A different browser/device (or cleared cookies) counts as a different voter.
  This is intentionally not a tamper-proof one-person-one-vote system.
- An additional keyed hash of the **source IP** is used only for a 40
  reaction-write-per-hour anti-spam limit. **Raw IP addresses are not stored**
  in the reaction tables. Old rate buckets are occasionally pruned.
- The existing `RATE_LIMIT_PEPPER` Pages secret is reused; **no new secrets,
  API keys, logins or external services** are required.

## Database and deletion

The two tables are defined in `db/003_gallery_hearts.sql`. The gallery
Function initialises them on first request via fixed, idempotent SQL, so no
manual D1 migration should be required. The SQL file is also available for
manual setup, review or recovery.

Cloudflare D1 enforces foreign keys by default. The
`ON DELETE CASCADE` relation automatically removes all hearts when staff
permanently delete a photograph from the gallery (R2 image + D1 metadata).
No existing photo metadata is modified by this change.

## Release/testing

- No changes to Cloudflare Access or to the private administration routes.
- All API updates require a matching same-origin request and a small JSON body.
- R2 images remain private; reactions require a published D1 photo ID.
- The public gallery stylesheet and script use versioned URLs to avoid stale
  copies after deployment.

Test from two browsers: heart/unheart a photo, refresh, ensure both
featured and grid counters match, then delete a test photo in
`/admin/gallery/` and confirm its heart records are gone. Avoid test
deletions of real images because deletion is permanent.

Note: The first view on a new deployment may do a small schema-creation
operation; if D1 is unavailable, the gallery returns an error rather than
displaying incorrect counts.
