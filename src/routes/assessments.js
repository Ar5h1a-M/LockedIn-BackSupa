/**
 * @openapi
 * /api/assessments:
 *   post:
 *     summary: Create an assessment/test entry
 *     tags: [Assessments]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, scope, test_date]
 *             properties:
 *               name: { type: string }
 *               scope: { type: string }
 *               test_date: { type: string, format: date-time }
 *     responses:
 *       200: { description: Created }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 */

/**
 * @openapi
 * /api/assessments/upcoming:
 *   get:
 *     summary: Get my next 3 upcoming assessments
 *     tags: [Assessments]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Upcoming tests
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tests:
 *                   type: array
 *                   items:
 *                     type: object
 *       401: { description: Unauthorized }
 */

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
