// routes/sessions.js
/**
 * @openapi
 * /api/groups/{groupId}/sessions:
 *   post:
 *     summary: Create a planned session
 *     tags: [Sessions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
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
 *     security: [{ bearerAuth: [] }]
 *     parameters:
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
 *     security: [{ bearerAuth: [] }]
 *     parameters:
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
 *     security: [{ bearerAuth: [] }]
 *     parameters:
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
 *     security: [{ bearerAuth: [] }]
 *     parameters:
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

// let transporter;

// if (process.env.NODE_ENV === "test") {
//   console.log("Test environment: Email functionality disabled");
//   transporter = {
//     sendMail: async () => {
//       console.log("[Mock email] sendMail called");
//       return Promise.resolve({ accepted: ["mock@example.com"] });
//     },
//     verify: async () => Promise.resolve(true),
//   };
// } else {
//   transporter = nodemailer.createTransport({
//     host: process.env.SMTP_HOST,
//     port: process.env.SMTP_PORT || 465,
//     secure: true,
//     auth: {
//       user: process.env.SMTP_USER,
//       pass: process.env.SMTP_PASS,
//     },
//     debug: true,
//     tls: {
//       rejectUnauthorized: false,
//     },
//   });

//   transporter.verify((error, success) => {
//     if (error) console.log("Test failed:", error);
//     else console.log("Server is ready to send messages");
//   });
// }

// export { transporter };

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
    const { start_at, venue, topic, time_goal_minutes, content_goal } =
      req.body || {};

    const isMember = await requireGroupMember(group_id, user.id);
    if (!isMember) return res.status(403).json({ error: "Not a group member" });

    if (!start_at) return res.status(400).json({ error: "start_at is required" });

    const starts = new Date(start_at);
    if (isNaN(starts.getTime()))
      return res.status(400).json({ error: "Invalid start_at" });
    if (starts < new Date())
      return res.status(400).json({ error: "start_at cannot be in the past" });

    // Insert session
    const { data: sessionData, error } = await supabase
      .from("sessions")
      .insert([
        {
          group_id,
          creator_id: user.id,
          start_at,
          venue,
          topic,
          time_goal_minutes,
          content_goal,
        },
      ])
      .select("*")
      .single();

    if (error) throw error;

    // Get group members
    const { data: members } = await supabase
      .from("group_members")
      .select("profiles(id, email, full_name)")
      .eq("group_id", group_id);

       if (!members || members.length === 0) return res.json({ session: sessionData });

    // Check conflicts per member
    const conflictPromises = members
      .filter(m => m.profiles.email && m.profiles.email !== user.email)
      .map(async (m) => {
        const { data: acceptedSessions } = await supabase
          .from("session_invites")
          .select("session_id")
          .eq("user_id", m.profiles.id)
          .eq("status", "accepted");

        const sessionIds = acceptedSessions.map(s => s.session_id);
        if (sessionIds.length === 0) return { member: m, conflict: false };

        const { data: conflicts } = await supabase
          .from("sessions")
          .select("id, start_at, topic")
          .in("id", sessionIds);

        const conflict = conflicts.some(c => new Date(c.start_at).getTime() === starts.getTime());
        return { member: m, conflict };
      });

    const conflictResults = await Promise.all(conflictPromises);

    // Send emails or notify creator
    const emailPromises = conflictResults.map(({ member, conflict }, index) => {
      return new Promise(async (resolve) => {
        try {
          if (conflict) {
            // Notify creator
            const { data: creator } = await supabase
              .from("profiles")
              .select("email, full_name")
              .eq("id", user.id)
              .single();

            if (creator?.email) {
              await transporter.sendMail({
                from: process.env.SMTP_USER,
                to: creator.email,
                subject: `Conflict: ${member.profiles.full_name} already booked`,
                text: `${member.profiles.full_name} has already accepted another session at ${start_at}.`,
              });
            }
          } else {
            // Send RSVP email
            const acceptLink = `${process.env.BACKEND_URL}/api/sessions/${sessionData.id}/accept/${member.profiles.id}`;
            const declineLink = `${process.env.BACKEND_URL}/api/sessions/${sessionData.id}/decline/${member.profiles.id}`;

            const htmlContent = `
              <h2>New Study Session Scheduled</h2>
              <p><strong>Date/Time:</strong> ${start_at}</p>
              <p><strong>Venue:</strong> ${venue}</p>
              <p><strong>Topic:</strong> ${topic}</p>
              <p><strong>Time goal:</strong> ${time_goal_minutes} mins</p>
              <p><strong>Content goal:</strong> ${content_goal}</p>
              <p>
                <a href="${acceptLink}" style="padding:10px 20px;background:#4CAF50;color:#fff;text-decoration:none;border-radius:5px;">
                  ✅ Accept
                </a>
                &nbsp;&nbsp;
                <a href="${declineLink}" style="padding:10px 20px;background:#f44336;color:#fff;text-decoration:none;border-radius:5px;">
                  ❌ Decline
                </a>
              </p>
            `;

            await transporter.sendMail({
              from: process.env.SMTP_USER,
              to: member.profiles.email,
              subject: `New Study Session in your group`,
              html: htmlContent,
            });
            // Insert pending invite
            await supabase.from("session_invites").insert({
              session_id: sessionData.id,
              user_id: member.profiles.id,
              status: "pending",
            });
          }
        } catch (err) {
          console.error(err);
        } finally {
          resolve(null);
        }
      });
    });

    await Promise.all(emailPromises);

    res.json({ session: sessionData });
  } catch (e) {
    next(e);
  }
});

/** RSVP via email links */
router.get("/sessions/:sessionId/accept/:userId", async (req, res) => {
  const { sessionId, userId } = req.params;
  const { error } = await supabase
    .from("session_invites")
    .upsert({
      session_id: sessionId,
      user_id: userId,
      status: "accepted",
      responded_at: new Date().toISOString(), 
    });
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
    });
  if (error) return res.status(500).send("Error updating RSVP");
  res.send("❌ You’ve declined the session.");
});

// POST /groups/:groupId/sessions/:sessionId/respond
router.post("/groups/:groupId/sessions/:sessionId/respond", async (req, res, next) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { groupId, sessionId } = req.params;
    const { status } = req.body; // "accepted" or "declined"

    if (!["accepted", "declined"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    // Must be member
    const isMember = await requireGroupMember(groupId, user.id);
    if (!isMember) return res.status(403).json({ error: "Not a group member" });

    // Fetch session
    const { data: session, error: sErr } = await supabase
      .from("sessions")
      .select("id, start_at, creator_id")
      .eq("id", sessionId)
      .single();
    if (sErr || !session) return res.status(404).json({ error: "Session not found" });

    // Conflict check: only if accepting
    if (status === "accepted") {
      const { data: conflicts, error: cErr } = await supabase
        .from("sessions")
        .select("id, start_at, topic")
        .in(
          "id",
          supabase
            .from("session_invites")
            .select("session_id")
            .eq("user_id", user.id)
            .eq("status", "accepted")
        );
      if (cErr) throw cErr;

      const conflict = conflicts.find(c => new Date(c.start_at).getTime() === new Date(session.start_at).getTime());
      if (conflict) {
        // Notify session creator
        const { data: prof } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).single();
        const { data: creator } = await supabase.from("profiles").select("email").eq("id", session.creator_id).single();

        if (creator?.email) {
          await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: creator.email,
            subject: `Conflict: ${prof?.full_name} already booked`,
            text: `${prof?.full_name} has already accepted another session at ${session.start_at}.`,
          });
        }

        return res.status(409).json({ error: "You already accepted a session at this time" });
      }
    }

    // Update invite status
    const { error } = await supabase
      .from("session_invites")
      .upsert({
        session_id: sessionId,
        user_id: user.id,
        status,
        responded_at: new Date().toISOString(),
      });

    if (error) throw error;

    res.json({ message: `Invite ${status}` });
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

