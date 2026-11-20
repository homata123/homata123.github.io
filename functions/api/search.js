// Ada's Feed — residents-group search endpoint (Cloudflare Pages Function)
// Route: /api/search — runs only on Cloudflare Pages, behind Cloudflare Access.
// POST {query} queues ONE search at a time in KV (binding REFRESH_KV,
// key "search:current"). GET reports whether a search is pending.
// An agent-side scheduled job picks the request up, searches the residents'
// Facebook group, scrubs personal contact details, publishes the results to
// search-results.json on the site and deletes the key when done.
// Requests expire on their own after 1 hour.

const KEY = "search:current";

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

export async function onRequestGet(context) {
  const raw = await context.env.REFRESH_KV.get(KEY);
  if (!raw) return json({ status: "idle" });
  try {
    const cur = JSON.parse(raw);
    return json({ status: "pending", query: cur.query || "", id: cur.id || "" });
  } catch (e) {
    return json({ status: "pending", query: "", id: "" });
  }
}

export async function onRequestPost(context) {
  // Access injects this header after the visitor signs in; without it the
  // request did not come through the Access wall.
  const email = context.request.headers.get("Cf-Access-Authenticated-User-Email");
  if (!email) return json({ error: "not authenticated" }, 403);

  let query = "";
  try {
    const body = await context.request.json();
    query = (body.query || "").toString().trim();
  } catch (e) { /* no body */ }
  if (query.length < 2 || query.length > 80) {
    return json({ error: "query must be 2-80 characters" }, 400);
  }

  const existing = await context.env.REFRESH_KV.get(KEY);
  if (existing) {
    try {
      const cur = JSON.parse(existing);
      return json({ status: "pending", query: cur.query || "", id: cur.id || "" });
    } catch (e) {
      return json({ status: "pending", query: "", id: "" });
    }
  }

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  await context.env.REFRESH_KV.put(
    KEY,
    JSON.stringify({ id: id, query: query, email: email, requested_at: new Date().toISOString() }),
    { expirationTtl: 3600 }
  );
  return json({ status: "queued", id: id, query: query });
}
