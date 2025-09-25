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

// POST /api/assessments
router.post("/assessments", async (req, res, next) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { name, scope, test_date } = req.body;
    const { data, error } = await supabase
      .from("tests")
      .insert([{ user_id: user.id, name, scope, test_date }])
      .select()
      .single();

    if (error) throw error;
    res.json({ test: data });
  } catch (err) { next(err); }
});

// GET /api/assessments/upcoming
router.get("/upcoming", async (req, res, next) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { data, error } = await supabase
      .from("tests")
      .select("*")
      .eq("user_id", user.id)
      .gte("test_date", new Date().toISOString())
      .order("test_date", { ascending: true })
      .limit(3);

    if (error) throw error;
    res.json({ tests: data });
  } catch (err) { next(err); }
});

export default router;
