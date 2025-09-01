// routes/profile.js
/**
 * @openapi
 * /api/profile:
 *   get:
 *     summary: Get my profile
 *     tags: [Profile]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Profile returned }
 *       401: { description: Unauthorized }
 */

/**
 * @openapi
 * /api/profile:
 *   put:
 *     summary: Update my profile
 *     tags: [Profile]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               degree: { type: string }
 *               modules: { type: array, items: { type: string } }
 *               interest: { type: string }
 *     responses:
 *       200: { description: Updated profile }
 *       401: { description: Unauthorized }
 */

/**
 * @openapi
 * /api/friends:
 *   get:
 *     summary: List my friends
 *     tags: [Profile]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Friends returned }
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

router.get("/profile", async (req, res, next) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, degree, modules, interest")
      .eq("id", user.id)
      .single();
    if (error) throw error;
    res.json({ profile: data });
  } catch (e) { next(e); }
});

router.put("/profile", async (req, res, next) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // Allowed fields to update from UI:
    const { degree, modules, interest } = req.body || {};
    const payload = {};
    if (degree !== undefined) payload.degree = degree;
    if (modules !== undefined) payload.modules = modules;
    if (interest !== undefined) payload.interest = interest;

    const { data, error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", user.id)
      .select("id, full_name, email, degree, modules, interest")
      .single();
    if (error) throw error;
    res.json({ profile: data });
  } catch (e) { next(e); }
});

router.get("/friends", async (req, res, next) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // Return my friends with their names
    const { data: edges, error: fErr } = await supabase
      .from("friendships")
      .select("friend_id")
      .eq("user_id", user.id);
    if (fErr) throw fErr;

    const ids = edges.map(e => e.friend_id);
    if (!ids.length) return res.json({ friends: [] });

    const { data: friends, error: pErr } = await supabase
      .from("profiles")
      .select("id, full_name, email, degree, modules, interest")
      .in("id", ids);
    if (pErr) throw pErr;

    res.json({ friends: friends || [] });
  } catch (e) { next(e); }
});

export default router;
