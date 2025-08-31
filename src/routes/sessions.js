// routes/sessions.js
import express from "express";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
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

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  debug:true,
  tls: {
    rejectUnauthorized: false, // allow self-signed / strict certs
  },
});

transporter.verify((error, success) => {
  if (error) console.log("Test failed:", error);
  else console.log("Server is ready to send messages");
});



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

    const starts = new Date(start_at);
    if (isNaN(starts.getTime())) return res.status(400).json({ error: "Invalid start_at" });
    if (starts < new Date()) return res.status(400).json({ error: "start_at cannot be in the past" });

    // Insert session
    const { data: sessionData, error } = await supabase
      .from("sessions")
      .insert([{ group_id, creator_id: user.id, start_at, venue, topic, time_goal_minutes, content_goal }])
      .select("*")
      .single();

    if (error) throw error;

    // Get group members
    const { data: members } = await supabase
      .from("group_members")
      .select("profiles(email, full_name)")
      .eq("group_id", group_id);

    if (!members || members.length === 0) {
      console.log("No members to email.");
    } else {
      console.log("Emails to send:", members.map(m => m.profiles.email));

      // Send emails asynchronously with throttling
      const emailPromises = members
        .filter(m => m.profiles.email && m.profiles.email !== user.email)
        .map((m, index) => {
          return new Promise(resolve => {
            // Delay each email by 300ms to avoid Gmail throttling
            setTimeout(async () => {
              try {
                await transporter.sendMail({
                  from: process.env.SMTP_USER,
                  to: m.profiles.email,
                  subject: `New Study Session in your group`,
                  text: `Hi ${m.profiles.full_name},\n\nA new study session has been scheduled:\n
Date/Time: ${start_at}\nVenue: ${venue}\nTopic: ${topic}\nTime goal: ${time_goal_minutes} mins\nContent goal: ${content_goal}\n\nJoin your group to participate!`,
                });
                console.log("Email sent to", m.profiles.email);
              } catch (err) {
                console.error("Failed to send email to", m.profiles.email, err);
              } finally {
                resolve(null); // resolve promise regardless of success/failure
              }
            }, index * 300); // stagger emails
          });
        });

      // Run all email promises but don't block the response too long
      Promise.allSettled(emailPromises);
    }

    res.json({ session: sessionData });
  } catch (e) {
    next(e);
  }
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

router.delete("/groups/:groupId/sessions/:sessionId", async (req, res, next) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const { groupId, sessionId } = req.params;

    // Must be member
    const isMember = await requireGroupMember(groupId, user.id);
    if (!isMember) return res.status(403).json({ error: "Not a group member" });

    // Must be creator
    const { data: s, error: sErr } = await supabase
      .from("sessions").select("id, creator_id").eq("id", sessionId).single();
    if (sErr) throw sErr;
    if (!s) return res.status(404).json({ error: "Session not found" });
    if (s.creator_id !== user.id) return res.status(403).json({ error: "Only the creator can delete" });

    const { error } = await supabase.from("sessions").delete().eq("id", sessionId);
    if (error) throw error;
    res.json({ message: "Session deleted" });
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

// GET /groups/:groupId/messages
router.get("/groups/:groupId/messages", async (req, res, next) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const group_id = req.params.groupId;
    const { sessionId, limit = 100 } = req.query;

    const isMember = await requireGroupMember(group_id, user.id);
    if (!isMember) return res.status(403).json({ error: "Not a group member" });

    let q = supabase
      .from("group_messages")
      .select("id, group_id, session_id, sender_id, content, attachment_url, created_at")
      .eq("group_id", group_id)
      .order("created_at", { ascending: false })
      .limit(Number(limit));
    if (sessionId) q = q.eq("session_id", sessionId);

    const { data: msgs, error } = await q;
    if (error) throw error;

    const senderIds = [...new Set((msgs||[]).map(m => m.sender_id))];
    let nameById = {};
    if (senderIds.length) {
      const { data: profs, error: pErr } = await supabase
        .from("profiles").select("id, full_name").in("id", senderIds);
      if (pErr) throw pErr;
      nameById = Object.fromEntries((profs||[]).map(p => [p.id, p.full_name]));
    }

    const enriched = (msgs||[]).map(m => ({ ...m, sender_name: nameById[m.sender_id] || null }));
    res.json({ messages: enriched.reverse() });
  } catch (e) { next(e); }
});


export default router;