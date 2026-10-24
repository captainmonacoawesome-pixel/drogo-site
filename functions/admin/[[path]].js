// Protect the administrative HTML pages on *every* hostname, including pages.dev.
// This complements Cloudflare Access policies and avoids exposing the admin UI
// when a custom-domain-only Access application can be bypassed via Pages.
import {verifyAccess} from "../api/ama/admin.js";

export async function onRequest({request,env}) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: {"Allow": "GET, HEAD", "Cache-Control": "no-store"}
    });
  }
  if (!await verifyAccess(request, env)) {
    return new Response("Staff sign-in required", {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow"
      }
    });
  }
  // ASSETS is Cloudflare's static-asset binding, not an external network fetch.
  // Only serves the existing static /admin assets after successful verification.
  const response = await env.ASSETS.fetch(request);
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("X-Robots-Tag", "noindex, nofollow");
  return new Response(response.body, {status: response.status, headers});
}
