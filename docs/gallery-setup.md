# Gallery (preview) rollout — R2 and D1

**DO NOT MERGE until preview upload/display tested and private administration confirmed.**

## Cloudflare preview resources

1. Run `db/002_gallery.sql` in the **existing** D1 `drogo-ama-preview` Console. Confirm `gallery_photos` table.
2. Create an R2 **Standard** bucket `drogo-gallery-preview` under Storage & databases → R2 Object Storage. Keep public access OFF. R2 Standard has free monthly allowances; payment details may be requested on first use.
3. In Pages project `drogo-site`, select **Preview** → Settings → Bindings → Add → R2 bucket. Choose variable `PHOTOS`, bucket `drogo-gallery-preview`. Production remains untouched.
4. Ensure Preview has `DB`, `ACCESS_TEAM_DOMAIN`, and `ACCESS_AUD` already working from Ask Meow Anything.
5. Push a new development commit to redeploy with bindings. Use the latest preview deployment URL.
6. Visit `/admin/gallery/` using Cloudflare Access. Submit a test iPhone photo, caption and check **Make this Cat Pic of the Day**.
7. Visit `/cat-pics/`; confirm photo and featured block. Return to admin and choose an older photo as daily; check only one is featured.
8. Inspect response headers: gallery page CSP permits `connect-src 'self'`, other pages retain original CSP. R2 bucket is not exposed publicly; the public image handler only resolves database-listed IDs.
9. Confirm a request to `/api/gallery/admin` without a valid signed Access JWT returns HTTP 401, even if the preview Access application was bypassed. Verify CORS/origin protections and test with an invalid image upload.
10. Later: production D1 database, production R2 bucket, production-specific admin Access application, migration and final launch.

## iPhone format and privacy

- The private admin form accepts Photos-library images including formats Safari can decode.
- Browser canvas downsizes to a maximum 1600px edge and exports JPEG, ordinarily stripping EXIF (including GPS metadata). Do not upload photographs containing visible sensitive details. Client-side re-encoding is **not** a guarantee of metadata removal against custom API clients.
- Only the owner/approved staff may upload. Visitors cannot upload to R2.
- Gallery images are fetched via our backend using private R2 bindings and the D1 list.
- No subscriber emails or notification automation have been enabled yet; that is the next project milestone.
