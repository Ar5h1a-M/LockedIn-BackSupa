// src/routes/search.js
/**
 * @openapi
 * /api/search:
 *   post:
 *     summary: Search profiles by modules/degree/interest/name
 *     tags: [Search]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [searchType, searchTerm]
 *             properties:
 *               searchType: { type: string, enum: [modules, degree, interest, name] }
 *               searchTerm: { type: string }
 *     responses:
 *       200:
 *         description: Profiles
 */

/**
 * @openapi
 * /api/invite:
 *   post:
 *     summary: Send a friend invite to another user
 *     tags: [Search]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [recipient_id]
 *             properties:
 *               recipient_id: { type: string }
 *     responses:
 *       200: { description: Invitation sent }
 *       401: { description: Invalid token }
 */

import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

// Create Supabase client - make it configurable for testing
export const createSupabaseClient = () => createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Use a function that can be overridden in tests
export let supabase = createSupabaseClient();

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
      for (const t of tokens) {
        query = query.ilike("full_name", `%${t}%`);
      }
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
    if (!recipient_id) {
      return res.status(400).json({ error: "Missing recipient_id" });
    }

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