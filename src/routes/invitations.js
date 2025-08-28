import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getUser(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error) throw error;
  return data?.user || null;
}

router.get("/invitations/received", async (req, res, next) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { data: inv, error } = await supabase
      .from("invitations")
      .select("id, sender_id, recipient_id, status, sent_at")
      .eq("recipient_id", user.id)
      .order("sent_at", { ascending: false });
    if (error) throw error;

    const senderIds = [...new Set(inv.map(i => i.sender_id))];
    let namesById = {};
    if (senderIds.length) {
      const { data: senders, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", senderIds);
      if (pErr) throw pErr;
      namesById = Object.fromEntries((senders || []).map(p => [p.id, p.full_name]));
    }

    const invitations = inv.map(i => ({ ...i, sender_name: namesById[i.sender_id] || null }));
    res.json({ invitations });
  } catch (e) {
    console.error("[/api/invitations/received] error:", e);
    next(e);
  }
});

router.get("/invitations/sent", async (req, res, next) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { data: inv, error } = await supabase
      .from("invitations")
      .select("id, sender_id, recipient_id, status, sent_at")
      .eq("sender_id", user.id)
      .order("sent_at", { ascending: false });
    if (error) throw error;

    const recipientIds = [...new Set(inv.map(i => i.recipient_id))];
    let namesById = {};
    if (recipientIds.length) {
      const { data: recips, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", recipientIds);
      if (pErr) throw pErr;
      namesById = Object.fromEntries((recips || []).map(p => [p.id, p.full_name]));
    }

    const invitations = inv.map(i => ({ ...i, recipient_name: namesById[i.recipient_id] || null }));
    res.json({ invitations });
  } catch (e) {
    console.error("[/api/invitations/sent] error:", e);
    next(e);
  }
});

router.put("/invitations/:id", async (req, res, next) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const { status } = req.body || {};
    if (!["accepted", "declined"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const { data: invite, error: fErr } = await supabase
      .from("invitations")
      .select("recipient_id, status")
      .eq("id", id)
      .single();
    if (fErr) throw fErr;
    if (!invite) return res.status(404).json({ error: "Invitation not found" });
    if (invite.recipient_id !== user.id) return res.status(403).json({ error: "Not authorized" });
    if (invite.status !== "pending") return res.status(400).json({ error: "Already handled" });

    const { error } = await supabase.from("invitations").update({ status }).eq("id", id);
    if (error) throw error;

    res.json({ message: `Invitation ${status}` });
  } catch (e) {
    console.error("[/api/invitations/:id] error:", e);
    next(e);
  }
});

export default router;