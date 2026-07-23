// Pool Party RSVP counter (Vercel function) — count starts at BASE, grows with each RSVP.
// GET  /api/rsvp        -> { count, storage }
// POST /api/rsvp {name} -> records RSVP (name optional), returns new { count }
// POST name "__test__"  -> round-trips a write then restores it (deploy probe)
// Storage: Vercel KV / Upstash Redis via REST (no SDK). Without storage env vars,
// GET still returns the base count and POST reports storage:"none".

const BASE = 66;
const KEY = "titans:rsvp:list";

const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function kvGet() {
  const r = await fetch(`${kvUrl}/get/${encodeURIComponent(KEY)}`, {
    headers: { Authorization: `Bearer ${kvToken}` },
  });
  const d = await r.json();
  return d && d.result ? JSON.parse(d.result) : [];
}

async function kvSet(list) {
  await fetch(`${kvUrl}/set/${encodeURIComponent(KEY)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${kvToken}` },
    body: JSON.stringify(list),
  });
}

export default async function handler(req, res) {
  res.setHeader("cache-control", "no-store");

  if (!kvUrl || !kvToken) {
    return res.status(200).json({ count: BASE, storage: "none" });
  }

  try {
    if (req.method === "GET") {
      const list = await kvGet();
      return res.status(200).json({ count: BASE + list.length, storage: "kv" });
    }

    if (req.method === "POST") {
      let name = "";
      try { name = String((req.body && req.body.name) || "").trim().slice(0, 80); } catch {}

      const list = await kvGet();

      if (name === "__test__") {
        const probe = [...list, { name, at: new Date().toISOString() }];
        await kvSet(probe);
        const back = await kvGet();
        await kvSet(list);
        return res.status(200).json({ count: BASE + list.length, probeOk: back.length === list.length + 1 });
      }

      list.push({ name: name || "Anonymous", at: new Date().toISOString() });
      await kvSet(list);
      return res.status(200).json({ count: BASE + list.length });
    }

    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: "storage error" });
  }
}
