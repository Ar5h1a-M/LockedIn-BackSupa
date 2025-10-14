// src/routes/sessions.js

/**
 * @openapi
 * /api/groups/{groupId}/sessions:
 *   post:
 *     summary: Create a planned session
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []         # normal mode
 *     parameters:
 *       - in: header
 *         name: x-partner-key
 *         required: false
 *         schema: { type: string }
 *         description: Partner API key (bypasses Bearer auth if valid)
 *       - in: path
 *         name: groupId
 *         schema: { type: integer }
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [start_at]
 *             properties:
 *               start_at: { type: string, format: date-time }
 *               venue: { type: string }
 *               topic: { type: string }
 *               time_goal_minutes: { type: integer }
 *               content_goal: { type: string }
 *     responses:
 *       200: { description: Created }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Not a group member }
 */

/**
 * @openapi
 * /api/groups/{groupId}/sessions:
 *   get:
 *     summary: List sessions for a group
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-partner-key
 *         required: false
 *         schema: { type: string }
 *         description: Partner API key (bypasses Bearer auth if valid)
 *       - in: path
 *         name: groupId
 *         schema: { type: integer }
 *         required: true
 *     responses:
 *       200: { description: Sessions returned }
 *       401: { description: Unauthorized }
 *       403: { description: Not a group member }
 */

/**
 * @openapi
 * /api/groups/{groupId}/sessions/{sessionId}:
 *   delete:
 *     summary: Delete a session (creator only)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-partner-key
 *         required: false
 *         schema: { type: string }
 *         description: Partner API key (bypasses Bearer auth if valid)
 *       - in: path
 *         name: groupId
 *         schema: { type: integer }
 *         required: true
 *       - in: path
 *         name: sessionId
 *         schema: { type: integer }
 *         required: true
 *     responses:
 *       200: { description: Deleted }
 *       401: { description: Unauthorized }
 *       403: { description: Only the creator can delete }
 *       404: { description: Not found }
 */

/**
 * @openapi
 * /api/groups/{groupId}/messages:
 *   post:
 *     summary: Post a group message
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-partner-key
 *         required: false
 *         schema: { type: string }
 *         description: Partner API key (bypasses Bearer auth if valid)
 *       - in: path
 *         name: groupId
 *         schema: { type: integer }
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               session_id: { type: integer }
 *               content: { type: string }
 *               attachment_url: { type: string }
 *     responses:
 *       200: { description: Created }
 *       400: { description: Missing content or attachment }
 *       401: { description: Unauthorized }
 *       403: { description: Not a group member }
 */

/**
 * @openapi
 * /api/groups/{groupId}/messages:
 *   get:
 *     summary: Get group messages (optionally by session)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-partner-key
 *         required: false
 *         schema: { type: string }
 *         description: Partner API key (bypasses Bearer auth if valid)
 *       - in: path
 *         name: groupId
 *         schema: { type: integer }
 *         required: true
 *       - in: query
 *         name: sessionId
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Messages returned }
 *       401: { description: Unauthorized }
 *       403: { description: Not a group member }
 */

/**
 * @openapi
 * /api/sessions/{sessionId}/accept/{userId}:
 *   get:
 *     summary: RSVP accept a session via email link
 *     tags: [Sessions]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         schema: { type: integer }
 *         required: true
 *       - in: path
 *         name: userId
 *         schema: { type: string }
 *         required: true
 *     responses:
 *       200: { description: Accepted }
 *       500: { description: Error updating RSVP }
 */

/**
 * @openapi
 * /api/sessions/{sessionId}/decline/{userId}:
 *   get:
 *     summary: RSVP decline a session via email link
 *     tags: [Sessions]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         schema: { type: integer }
 *         required: true
 *       - in: path
 *         name: userId
 *         schema: { type: string }
 *         required: true
 *     responses:
 *       200: { description: Declined }
 *       500: { description: Error updating RSVP }
 */

import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* ---------------------------- access helpers ---------------------------- */

function partnerOK(req) {
  const hdr = req.header("x-partner-key");
  const key = process.env.PARTNER_API_KEY;
  return !!hdr && !!key && hdr === key;
}
function publicAll() {
  return String(process.env.PUBLIC_SESSIONS_ALL || "").toLowerCase() === "true";
}
function publicReadOnly() {
  return String(process.env.PUBLIC_SESSIONS_READONLY || "").toLowerCase() === "true";
}

/**
 * auth gate:
 * - if partner header matches => allow (unauthenticated mode)
 * - if PUBLIC_SESSIONS_ALL=true => allow all
 * - if PUBLIC_SESSIONS_READONLY=true => allow GETs
 * - else => require Bearer and set req.user
 */
async function authGate(req, res, next) {
  try {
    if (partnerOK(req) || publicAll() || (publicReadOnly() && req.method === "GET")) {
      req.authMode = "partner-or-public";
      return next();
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: "Unauthorized" });

    req.user = data.user;          // { id, email, ... }
    req.authMode = "bearer";
    next();
  } catch (e) {
    next(e);
  }
}

async function requireGroupMember(group_id, user_id) {
  const { data, error } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", group_id)
    .eq("user_id", user_id)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

/* ---------------------------- utility helpers --------------------------- */

function buildBaseUrl(req) {
  const envBase = (process.env.BACKEND_URL || "").trim();
  if (envBase) return envBase.replace(/\/+$/, "");
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${proto}://${host}`;
}

/* ================================ routes ================================ */

/** Create a session (planner) */
router.post("/groups/:groupId/sessions", authGate, async (req, res, next) => {
  try {
    const group_id = req.params.groupId;
    const { start_at, venue, topic, time_goal_minutes, content_goal } = req.body || {};

    if (!start_at) return res.status(400).json({ error: "start_at is required" });
    const starts = new Date(start_at);
    if (isNaN(starts.getTime())) return res.status(400).json({ error: "Invalid start_at" });
    if (starts < new Date()) return res.status(400).json({ error: "start_at cannot be in the past" });

    // membership check only in bearer mode
    if (req.authMode === "bearer") {
      const isMember = await requireGroupMember(group_id, req.user.id);
      if (!isMember) return res.status(403).json({ error: "Not a group member" });
    }

    const creator_id = req.user?.id || null;

    const { data: sessionData, error } = await supabase
      .from("sessions")
      .insert([{ group_id, creator_id, start_at, venue, topic, time_goal_minutes, content_goal }])
      .select("*")
      .single();
    if (error) throw error;

    // NOTE: email sending intentionally removed (handled by another teammate)
    // you still get the RSVP links here if you want to include them somewhere:
    const baseUrl = buildBaseUrl(req);
    sessionData.accept_link = `${baseUrl}/api/sessions/${sessionData.id}/accept/${creator_id || "guest"}`;
    sessionData.decline_link = `${baseUrl}/api/sessions/${sessionData.id}/decline/${creator_id || "guest"}`;

    return res.json({ session: sessionData });
  } catch (e) {
    next(e);
  }
});

/** List sessions for a group */
router.get("/groups/:groupId/sessions", authGate, async (req, res, next) => {
  try {
    const group_id = req.params.groupId;

    if (req.authMode === "bearer") {
      const isMember = await requireGroupMember(group_id, req.user.id);
      if (!isMember) return res.status(403).json({ error: "Not a group member" });
    }
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("group_id", group_id)
      .order("start_at", { ascending: true });
    if (error) throw error;

    res.json({ sessions: data || [] });
  } catch (e) {
    next(e);
  }
});

/** Delete a session (creator only in bearer mode) */
router.delete("/groups/:groupId/sessions/:sessionId", authGate, async (req, res, next) => {
  try {
    const { groupId, sessionId } = req.params;

    if (req.authMode === "bearer") {
      const isMember = await requireGroupMember(groupId, req.user.id);
      if (!isMember) return res.status(403).json({ error: "Not a group member" });

      const { data: s, error: sErr } = await supabase
        .from("sessions")
        .select("id, creator_id")
        .eq("id", sessionId)
        .single();
      if (sErr) throw sErr;
      if (!s) return res.status(404).json({ error: "Session not found" });
      if (s.creator_id !== req.user.id) return res.status(403).json({ error: "Only the creator can delete" });
    }

    const { error } = await supabase.from("sessions").delete().eq("id", sessionId);
    if (error) throw error;
    res.json({ message: "Session deleted" });
  } catch (e) {
    next(e);
  }
});

/** RSVP via email links (public GETs) */
router.get("/sessions/:sessionId/accept/:userId", async (req, res) => {
  const { sessionId, userId } = req.params;
  const { error } = await supabase
    .from("session_invites")
    .upsert({
      session_id: sessionId,
      user_id: userId,
      status: "accepted",
      responded_at: new Date().toISOString(),
    }, { onConflict: "session_id,user_id" });
  if (error) return res.status(500).send("Error updating RSVP");
  res.send("✅ You’ve accepted the session!");
});

router.get("/sessions/:sessionId/decline/:userId", async (req, res) => {
  const { sessionId, userId } = req.params;
  const { error } = await supabase
    .from("session_invites")
    .upsert({
      session_id: sessionId,
      user_id: userId,
      status: "declined",
      responded_at: new Date().toISOString(),
    }, { onConflict: "session_id,user_id" });
  if (error) return res.status(500).send("Error updating RSVP");
  res.send("❌ You’ve declined the session.");
});

/** Post a message */
router.post("/groups/:groupId/messages", authGate, async (req, res, next) => {
  try {
    const group_id = req.params.groupId;
    const { session_id, content, attachment_url } = req.body || {};

    if (req.authMode === "bearer") {
      const isMember = await requireGroupMember(group_id, req.user.id);
      if (!isMember) return res.status(403).json({ error: "Not a group member" });
    }

    if (!content && !attachment_url) {
      return res.status(400).json({ error: "content or attachment_url required" });
    }

    const sender_id = req.user?.id || null;

    const { data, error } = await supabase
      .from("group_messages")
      .insert([{ group_id, session_id: session_id || null, sender_id, content, attachment_url }])
      .select("*")
      .single();
    if (error) throw error;

    res.json({ message: data });
  } catch (e) {
    next(e);
  }
});

/** Get messages */
router.get("/groups/:groupId/messages", authGate, async (req, res, next) => {
  try {
    const group_id = req.params.groupId;
    const { sessionId, limit = 100 } = req.query;

    if (req.authMode === "bearer") {
      const isMember = await requireGroupMember(group_id, req.user.id);
      if (!isMember) return res.status(403).json({ error: "Not a group member" });
    }

    let q = supabase
      .from("group_messages")
      .select("id, group_id, session_id, sender_id, content, attachment_url, created_at")
      .eq("group_id", group_id)
      .order("created_at", { ascending: false })
      .limit(Number(limit));
    if (sessionId) q = q.eq("session_id", sessionId);

    const { data: msgs, error } = await q;
    if (error) throw error;

    // attach sender names (best effort)
    const senderIds = [...new Set((msgs || []).map((m) => m.sender_id).filter(Boolean))];
    let nameById = {};
    if (senderIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", senderIds);
      nameById = Object.fromEntries((profs || []).map((p) => [p.id, p.full_name]));
    }

    const enriched = (msgs || []).map((m) => ({
      ...m,
      sender_name: m.sender_id ? (nameById[m.sender_id] || null) : "partner",
    })).reverse();

    res.json({ messages: enriched });
  } catch (e) {
    next(e);
  }
});

export default router;
