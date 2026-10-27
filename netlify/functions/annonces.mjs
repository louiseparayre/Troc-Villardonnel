import { getStore } from "@netlify/blobs";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const clip = (v, n) => String(v ?? "").slice(0, n);

export default async (req) => {
const store = getStore({ name: "annonces", consistency: "strong" });
  if (req.method === "GET") {
    const { blobs } = await store.list();
    const items = (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })))).filter(Boolean);
    return json(items);
  }

  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: "JSON invalide" }, 400); }

  if (body.action === "add") {
    const i = body.item || {};
    const item = {
      id: clip(i.id, 40) || crypto.randomUUID(),
      type: i.type === "recherche" ? "recherche" : "propose",
      category: clip(i.category, 20),
      title: clip(i.title, 70),
      description: clip(i.description, 400),
      author: clip(i.author, 40),
      contact: clip(i.contact, 60),
      createdAt: Number(i.createdAt) || Date.now(),
      replies: [],
    };
    if (!item.title || !item.description || !item.author) return json({ error: "Champs manquants" }, 400);
    await store.setJSON(item.id, item);
    return json({ ok: true });
  }

  if (body.action === "remove") {
    await store.delete(clip(body.id, 40));
    return json({ ok: true });
  }

  if (body.action === "reply") {
    const id = clip(body.id, 40);
    const item = await store.get(id, { type: "json" });
    if (!item) return json({ error: "Annonce introuvable" }, 404);
    const author = clip(body.reply?.author, 40);
    if (!author) return json({ error: "Prénom manquant" }, 400);
    item.replies = item.replies || [];
    item.replies.push({ author, contact: clip(body.reply?.contact, 60), createdAt: Date.now() });
    await store.setJSON(id, item);
    return json({ ok: true });
  }

  return json({ error: "Action inconnue" }, 400);
};
