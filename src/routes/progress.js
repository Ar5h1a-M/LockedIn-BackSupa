// routes/progress.js
import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getUser(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error) throw error;
  return data?.user || null;
}

/** Get recent (last 7–14) entries */
router.get("/progress", async (req, res, next) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const { data, error } = await supabase
      .from("user_progress")
      .select("date, hours, productivity, notes")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(14);
    if (error) throw error;
    res.json({ entries: data || [] });
  } catch (e) { next(e); }
});

/** Upsert one day */
router.post("/progress", async (req, res, next) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const { date, hours, productivity, notes } = req.body || {};
    if (!date || hours === undefined) return res.status(400).json({ error: "date and hours required" });

    const { data, error } = await supabase
      .from("user_progress")
      .upsert([{ user_id: user.id, date, hours, productivity, notes, updated_at: new Date().toISOString() }], {
        onConflict: "user_id,date",
      })
      .select("date, hours, productivity, notes")
      .single();
    if (error) throw error;
    res.json({ entry: data });
  } catch (e) { next(e); }
});

export default router;