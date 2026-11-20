// Ada's Feed — realtime token endpoint (Cloudflare Pages Function)
// Route: /api/rt-token — runs only on Cloudflare Pages, behind Cloudflare Access.
// Returns a short-lived (10 min) HMAC token that the page uses to open a
// WebSocket to the adas-relay Worker (wss://.../browser?token=...). The
// Worker verifies the same HMAC with its RT_SECRET binding; the Pages side
// reads RT_SECRET from its own env vars. The token carries only the visitor's
// Access-authenticated email and an expiry — no other data.

const RELAY_URL = "wss://adas-relay.ilias52544-13c.workers.dev/browser";

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
function b64urlEncode(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequestGet(context) {
  const email = context.request.headers.get("Cf-Access-Authenticated-User-Email");
  if (!email) return json({ error: "not authenticated" }, 403);
  const secret = context.env.RT_SECRET;
  if (!secret) return json({ error: "relay not configured" }, 500);
  const exp = Math.floor(Date.now() / 1000) + 600;
  const sig = await hmacHex(secret, exp + "." + email);
  const token = exp + "." + b64urlEncode(email) + "." + sig;
  return json({ token: token, exp: exp, relay: RELAY_URL });
}
