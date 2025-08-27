import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

router.post("/search", async (req, res) => {
  const { searchType, searchTerm } = req.body;
  if (!["modules", "degree", "study_interest"].includes(searchType)) {
    return res.status(400).json({ error: "Invalid search type" });
  }

  let query = supabase.from("profiles").select("id, full_name, degree, modules, study_interest").limit(15);

  if (searchType === "modules") {
    query = query.contains("modules", [searchTerm]);
  } else {
    query = query.ilike(searchType, `%${searchTerm}%`);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.json({ results: data });
});

// Invite endpoint
router.post("/invite", async (req, res) => {
  const { recipient_id } = req.body;
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return res.status(401).json({ error: "Invalid token" });

  const { error } = await supabase.from("invitations").insert([{
    sender_id: user.id,
    recipient_id,
    status: "pending",
  }]);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: "Invitation sent" });
});

export default router;
