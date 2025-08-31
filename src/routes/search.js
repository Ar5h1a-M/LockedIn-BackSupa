import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

// Ensure SR key here (server-side only)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SEARCH_MAP = {
  modules: "modules",
  degree: "degree",
  interest: "interest",
  full_name: "full_name",
  name: "full_name",
};

router.post("/search", async (req, res, next) => {
  try {
    let { searchType, searchTerm } = req.body || {};
    searchTerm = (searchTerm || "").trim();
    if (!searchTerm) return res.json({ profiles: [] });

    const column = SEARCH_MAP[searchType];
    if (!column) return res.status(400).json({ error: "Invalid search type" });

    let query = supabase
      .from("profiles")
      .select("id, full_name, degree, modules, interest")
      .limit(15);

    if (column === "modules") {
      // exact token match in array column
      query = query.contains("modules", [searchTerm]);
    } else if (column === "full_name") {
      const tokens = searchTerm.split(/\s+/).filter(Boolean);
      for (const t of tokens) query = query.ilike("full_name", `%${t}%`);
    } else {
      query = query.ilike(column, `%${searchTerm}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ profiles: data || [] });
  } catch (e) {
    console.error("[/api/search] error:", e);
    next(e);
  }
});

router.post("/invite", async (req, res, next) => {
  try {
    const { recipient_id } = req.body || {};
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    const { data: userResp, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) throw userErr;
    const user = userResp?.user;
    if (!user) return res.status(401).json({ error: "Invalid token" });

    const { error } = await supabase
      .from("invitations")
      .insert([{ sender_id: user.id, recipient_id, status: "pending" }]);
    if (error) throw error;

    res.json({ message: "Invitation sent" });
  } catch (e) {
    console.error("[/api/invite] error:", e);
    next(e);
  }
});

export default router;