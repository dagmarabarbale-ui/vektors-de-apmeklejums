// Pasākumu saraksts (Netlify Function + Netlify Blobs).
// GET  /api/events                           -> [ {id,date,time,kind,title,place,info}, ... ]
// POST /api/events {pin, action:"check"}       -> pārbauda vadītāja PIN
// POST /api/events {pin, action:"save", event} -> pievieno vai labo pasākumu
// POST /api/events {pin, action:"delete", id}  -> dzēš pasākumu
// PIN iestata Netlify vides mainīgajā ADMIN_PIN (Site configuration → Environment variables).
import { getStore } from "@netlify/blobs";

const ID_RE = /^[A-Za-z0-9_-]{1,60}$/;
const KINDS = ["Koncerts", "Mēģinājums", "Filmēšana", "Cits"];
const str = (v, max) => String(v ?? "").slice(0, max);

export default async (req) => {
  const store = getStore({ name: "pasakumi", consistency: "strong" });

  if (req.method === "GET") {
    const { blobs } = await store.list();
    const list = (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })))).filter(Boolean);
    // Deju sastāvus redz tikai vadītāja (ar pareizu PIN galvenē x-admin-pin)
    const isAdmin = !!process.env.ADMIN_PIN && req.headers.get("x-admin-pin") === process.env.ADMIN_PIN;
    // Dalībniekiem rāda deju nosaukumus, bet ne sastāvus
    const out = isAdmin ? list : list.map((e) => ({ ...e, dances: (e.dances || []).map((d) => ({ id: d.id, name: d.name, cast: [] })) }));
    return Response.json(out, { headers: { "cache-control": "no-store" } });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let body;
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  const expected = process.env.ADMIN_PIN;
  if (!expected || String(body?.pin ?? "") !== expected) return new Response("Wrong PIN", { status: 401 });

  if (body.action === "check") return Response.json({ ok: true });

  if (body.action === "save") {
    const e = body.event || {};
    if (!ID_RE.test(e.id || "") || !/^\d{4}-\d{2}-\d{2}$/.test(e.date || "")) return new Response("Bad event", { status: 400 });
    const ev = {
      id: e.id, date: e.date, time: str(e.time, 40),
      kind: KINDS.includes(e.kind) ? e.kind : "Cits",
      title: str(e.title, 200), place: str(e.place, 200), info: str(e.info, 5000),
      program: e.program && typeof e.program.html === "string" && e.program.html
        ? { name: str(e.program.name, 200), html: str(e.program.html, 300000) } : null,
      dances: (Array.isArray(e.dances) ? e.dances : []).slice(0, 60)
        .filter((d) => d && ID_RE.test(String(d.id || "")))
        .map((d) => ({
          id: String(d.id), name: str(d.name, 150),
          cast: (Array.isArray(d.cast) ? d.cast : []).map(String).filter((m) => ID_RE.test(m)).slice(0, 100),
        })),
    };
    await store.setJSON(ev.id, ev);
    return Response.json({ ok: true });
  }

  if (body.action === "delete") {
    if (!ID_RE.test(body.id || "")) return new Response("Bad id", { status: 400 });
    await store.delete(body.id);
    return Response.json({ ok: true });
  }

  return new Response("Bad action", { status: 400 });
};

export const config = { path: "/api/events" };
