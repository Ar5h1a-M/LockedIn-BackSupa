// routes/sessions.js
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

/** Create a session (planner) */
router.post("/groups/:groupId/sessions", async (req, res, next) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const group_id = req.params.groupId;
    const { start_at, venue, topic, time_goal_minutes, content_goal } = req.body || {};

    const isMember = await requireGroupMember(group_id, user.id);
    if (!isMember) return res.status(403).json({ error: "Not a group member" });

    if (!start_at) return res.status(400).json({ error: "start_at is required" });

    const { data, error } = await supabase
      .from("sessions")
      .insert([{ group_id, creator_id: user.id, start_at, venue, topic, time_goal_minutes, content_goal }])
      .select("*")
      .single();
    if (error) throw error;
    res.json({ session: data });
  } catch (e) { next(e); }
});

/** List upcoming sessions for a group */
router.get("/groups/:groupId/sessions", async (req, res, next) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const group_id = req.params.groupId;

    const isMember = await requireGroupMember(group_id, user.id);
    if (!isMember) return res.status(403).json({ error: "Not a group member" });

    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("group_id", group_id)
      .order("start_at", { ascending: true });
    if (error) throw error;
    res.json({ sessions: data || [] });
  } catch (e) { next(e); }
});

/** Get recent group chat (optionally session-scoped) */
router.get("/groups/:groupId/messages", async (req, res, next) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const group_id = req.params.groupId;
    const { sessionId, limit = 100 } = req.query;

    const isMember = await requireGroupMember(group_id, user.id);
    if (!isMember) return res.status(403).json({ error: "Not a group member" });

    let query = supabase
      .from("group_messages")
      .select("id, group_id, session_id, sender_id, content, attachment_url, created_at")
      .eq("group_id", group_id)
      .order("created_at", { ascending: false })
      .limit(Number(limit));

    if (sessionId) query = query.eq("session_id", sessionId);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ messages: (data || []).reverse() }); // reverse to chronological
  } catch (e) { next(e); }
});

/** Post a message (text and/or attachment_url) */
router.post("/groups/:groupId/messages", async (req, res, next) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const group_id = req.params.groupId;
    const { session_id, content, attachment_url } = req.body || {};

    const isMember = await requireGroupMember(group_id, user.id);
    if (!isMember) return res.status(403).json({ error: "Not a group member" });

    if (!content && !attachment_url) {
      return res.status(400).json({ error: "content or attachment_url required" });
    }

    const { data, error } = await supabase
      .from("group_messages")
      .insert([{ group_id, session_id: session_id || null, sender_id: user.id, content, attachment_url }])
      .select("*")
      .single();
    if (error) throw error;

    res.json({ message: data });
  } catch (e) { next(e); }
});

export default router;