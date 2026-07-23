// Christmas in July RSVP counter — count starts at BASE and grows with each RSVP.
// GET  /api/rsvp            -> { count }
// POST /api/rsvp {name}     -> records RSVP (name optional), returns new { count }
// POST with name "__test__" -> round-trips a write then restores it (deploy probe)
import { getStore } from "@netlify/blobs";

const BASE = 66;

export default async (req) => {
  const store = getStore("rsvp");
  const headers = { "content-type": "application/json", "cache-control": "no-store" };

  if (req.method === "GET") {
    const list = (await store.get("list", { type: "json" })) || [];
    return new Response(JSON.stringify({ count: BASE + list.length }), { headers });
  }

  if (req.method === "POST") {
    let name = "";
    try {
      const body = await req.json();
      name = String(body.name || "").trim().slice(0, 80);
    } catch {}

    const list = (await store.get("list", { type: "json" })) || [];

    if (name === "__test__") {
      const probe = [...list, { name, at: new Date().toISOString() }];
      await store.setJSON("list", probe);
      const back = (await store.get("list", { type: "json" })) || [];
      await store.setJSON("list", list);
      return new Response(
        JSON.stringify({ count: BASE + list.length, probeOk: back.length === list.length + 1 }),
        { headers }
      );
    }

    list.push({ name: name || "Anonymous", at: new Date().toISOString() });
    await store.setJSON("list", list);
    return new Response(JSON.stringify({ count: BASE + list.length }), { headers });
  }

  return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers });
};

export const config = { path: "/api/rsvp" };
