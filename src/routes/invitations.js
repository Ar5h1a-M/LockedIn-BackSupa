import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper to extract Supabase user
async function getUserFromToken(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

// Get received invitations
router.get("/invitations/received", async (req, res) => {
  const user = await getUserFromToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { data, error } = await supabase
    .from("invitations")
    .select("id, sender_id, recipient_id, status, sent_at, profiles!invitations_sender_id_fkey(full_name)")
    .eq("recipient_id", user.id)
    .order("sent_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ invitations: data });
});

// Get sent invitations
router.get("/invitations/sent", async (req, res) => {
  const user = await getUserFromToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { data, error } = await supabase
    .from("invitations")
    .select("id, sender_id, recipient_id, status, sent_at, profiles!invitations_recipient_id_fkey(full_name)")
    .eq("sender_id", user.id)
    .order("sent_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ invitations: data });
});

// Accept/Decline invitation
router.put("/invitations/:id", async (req, res) => {
  const user = await getUserFromToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.params;
  const { status } = req.body;

  if (!["accepted", "declined"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  // Ensure recipient is the one updating
  const { data: invite, error: findError } = await supabase
    .from("invitations")
    .select("recipient_id, status")
    .eq("id", id)
    .single();

  if (findError || !invite) return res.status(404).json({ error: "Invitation not found" });
  if (invite.recipient_id !== user.id) return res.status(403).json({ error: "Not authorized" });
  if (invite.status !== "pending") return res.status(400).json({ error: "Invitation already handled" });

  const { error } = await supabase
    .from("invitations")
    .update({ status })
    .eq("id", id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: `Invitation ${status}` });
});

export default router;
