// Ada's Feed — on-demand refresh endpoint (Cloudflare Pages Function)
// Route: /api/refresh — runs only on Cloudflare Pages, behind Cloudflare Access.
// POST {topic} queues a refresh request in KV (binding REFRESH_KV, key "req:<topic>").
// GET ?topic=<topic> reports whether a request for that topic is pending.
// An agent-side scheduled job polls the KV mailbox, runs the scoped collection
// and deletes the key when done. Requests expire on their own after 2 hours.

const TOPICS = ["all", "ai", "science", "game", "video", "youtube", "facebook", "residents"];

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

export async function onRequestGet(context) {
  const topic = new URL(context.request.url).searchParams.get("topic") || "";
  if (!TOPICS.includes(topic)) return json({ error: "unknown topic" }, 400);
  const existing = await context.env.REFRESH_KV.get("req:" + topic);
  return json({ topic: topic, status: existing ? "pending" : "idle" });
}

export async function onRequestPost(context) {
  // Access injects this header after the visitor signs in; without it the
  // request did not come through the Access wall.
  const email = context.request.headers.get("Cf-Access-Authenticated-User-Email");
  if (!email) return json({ error: "not authenticated" }, 403);

  let topic = "";
  try {
    const body = await context.request.json();
    topic = body.topic || "";
  } catch (e) { /* fall through to query param */ }
  if (!topic) topic = new URL(context.request.url).searchParams.get("topic") || "";
  if (!TOPICS.includes(topic)) return json({ error: "unknown topic" }, 400);

  const key = "req:" + topic;
  const existing = await context.env.REFRESH_KV.get(key);
  if (existing) return json({ topic: topic, status: "pending" });

  await context.env.REFRESH_KV.put(
    key,
    JSON.stringify({ requested_at: new Date().toISOString(), email: email }),
    { expirationTtl: 7200 }
  );
  return json({ topic: topic, status: "queued" });
}
