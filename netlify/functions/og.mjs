// Saites priekšskatījuma attēls (WhatsApp, Facebook u.c.).
// GET  /og.png -> PNG attēls
// POST /og.png  (galvenē x-admin-pin) -> saglabā jaunu attēlu
import { getStore } from "@netlify/blobs";

export default async (req) => {
  const store = getStore({ name: "og", consistency: "strong" });

  if (req.method === "GET" || req.method === "HEAD") {
    const buf = await store.get("og.png", { type: "arrayBuffer" });
    if (!buf) return new Response("Not found", { status: 404 });
    return new Response(req.method === "HEAD" ? null : buf, {
      headers: { "content-type": "image/png", "cache-control": "public, max-age=3600" },
    });
  }

  if (req.method === "POST") {
    const expected = process.env.ADMIN_PIN;
    if (!expected || req.headers.get("x-admin-pin") !== expected) return new Response("Wrong PIN", { status: 401 });
    const buf = await req.arrayBuffer();
    if (buf.byteLength > 1000000) return new Response("Too big", { status: 413 });
    await store.set("og.png", buf);
    return Response.json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config = { path: "/og.png" };
