// Dē grupas apmeklējuma glabātuve (Netlify Function + Netlify Blobs).
// GET  /api/attendance          -> { "<notikums>__<dalībnieks>": "tiek" | "netiek", ... }
// POST /api/attendance {key, status}   status: "tiek" | "netiek" | null (dzēst)
import { getStore } from "@netlify/blobs";

const KEY_RE = /^[A-Za-z0-9_-]{1,80}$/;

export default async (req) => {
  const store = getStore({ name: "apmeklejums", consistency: "strong" });

  if (req.method === "GET") {
    const { blobs } = await store.list();
    const entries = await Promise.all(
      blobs.map(async (b) => [b.key, await store.get(b.key)])
    );
    return Response.json(Object.fromEntries(entries.filter(([, v]) => v)), {
      headers: { "cache-control": "no-store" },
    });
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
    const { key, status } = body || {};
    if (!KEY_RE.test(key || "")) return new Response("Bad key", { status: 400 });
    if (status === "tiek" || status === "netiek") await store.set(key, status);
    else if (status == null || status === "") await store.delete(key);
    else return new Response("Bad status", { status: 400 });
    return Response.json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config = { path: "/api/attendance" };
