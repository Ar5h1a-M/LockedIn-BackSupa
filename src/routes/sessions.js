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
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Keep your existing helper functions
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

// Email service setup with test preservation
let emailService;

if (process.env.NODE_ENV === "test") {
  console.log("Test environment: Email functionality disabled");
  emailService = {
    sendEmail: async (to, subject, html, text) => {
      console.log("[Mock email] sendEmail called to:", to);
      return Promise.resolve({ 
        success: true,
        to: to,
        subject: subject 
      });
    }
  };
} else {
  // Production: Use Mailjet
  emailService = {
    sendEmail: async (to, subject, html, text) => {
      try {
        // Import node-fetch for HTTP requests to Mailjet API
        const fetch = (await import('node-fetch')).default;
        
        const response = await fetch('https://api.mailjet.com/v3.1/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + Buffer.from(
              process.env.MJ_APIKEY_PUBLIC + ':' + process.env.MJ_APIKEY_PRIVATE
            ).toString('base64')
          },
          body: JSON.stringify({
            Messages: [
              {
                From: {
                  Email: "lockedin@lockedin-backsupa.onrender.com",
                  Name: "LockedIn Study Groups"
                },
                To: [
                  {
                    Email: to,
                    Name: to.split('@')[0]
                  }
                ],
                Subject: subject,
                HTMLPart: html,
                TextPart: text || html.replace(/<[^>]*>/g, '')
              }
            ]
          })
        });

        const result = await response.json();
        
        if (response.ok) {
          console.log(`✅ Email sent to: ${to}`);
          return result;
        } else {
          console.error(`❌ Mailjet API error for ${to}:`, result);
          return { error: result.ErrorMessage || 'Mailjet API error' };
        }
      } catch (error) {
        console.error(`❌ Failed to send email to ${to}:`, error);
        return { error: error.message };
      }
    }
  };
}

// Safe email function that works in both test and production
async function sendEmailSafe(to, subject, html, text) {
  return await emailService.sendEmail(to, subject, html, text);
}

// Export for tests
export { emailService };

// Test Mailjet endpoint
router.get("/test-mailjet", async (req, res) => {
  try {
    console.log('Testing Mailjet with any email...');
    
    const result = await sendEmailSafe(
      'njam.arshia@gmail.com', // Test with ANY email - no verification needed!
      'Mailjet Test - Should Work With Any Email!',
      '<h1>Mailjet Test</h1><p>This should work immediately with any email address!</p>'
    );
    
    console.log('Mailjet test result:', result);
    res.json({ 
      success: true, 
      message: 'Mailjet test completed! Check njam.arshia@gmail.com',
      result 
    });
  } catch (error) {
    console.error('Mailjet test failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});


/** Create a session (planner) - Updated for Resend but test-compatible */
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
      .insert([{ 
        group_id, 
        creator_id: user.id, 
        start_at, 
        venue, 
        topic, 
        time_goal_minutes, 
        content_goal 
      }])
      .select("*")
      .single();

    if (error) throw error;

    // Get group members (excluding creator)
    const { data: members, error: membersError } = await supabase
      .from("group_members")
      .select("profiles(id, email, full_name)")
      .eq("group_id", group_id)
      .neq("user_id", user.id);

    if (membersError) {
      console.error("Error fetching members:", membersError);
      return res.json({ session: sessionData });
    }

    if (!members || members.length === 0) {
      console.log("No members to email.");
      return res.json({ session: sessionData });
    }

    console.log("Processing emails for members:", members.map(m => m.profiles.email));

    // Process members with email sending
    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      const memberProfile = member.profiles;
      
      if (!memberProfile.email) continue;

      // Add delay between emails
      if (i > 0) await new Promise(resolve => setTimeout(resolve, 300));
      
      try {
        // Check for conflicts
        const { data: acceptedSessions } = await supabase
          .from("session_invites")
          .select("session_id")
          .eq("user_id", memberProfile.id)
          .eq("status", "accepted");

        let hasConflict = false;
        if (acceptedSessions && acceptedSessions.length > 0) {
          const sessionIds = acceptedSessions.map(s => s.session_id);
          const { data: conflicts } = await supabase
            .from("sessions")
            .select("id, start_at, topic")
            .in("id", sessionIds);

          if (conflicts) {
            hasConflict = conflicts.some(c => new Date(c.start_at).getTime() === starts.getTime());
          }
        }

        if (hasConflict) {
          console.log(`Conflict detected for ${memberProfile.full_name}`);
          
          const { data: creator } = await supabase
            .from("profiles")
            .select("email, full_name")
            .eq("id", user.id)
            .single();

          if (creator?.email) {
            await sendEmailSafe(
              creator.email,
              `Conflict: ${memberProfile.full_name} already booked`,
              `${memberProfile.full_name} has already accepted another session at ${start_at}.`
            );
          }
        } else {
          // Send RSVP email
          const acceptLink = `${process.env.BACKEND_URL}/api/sessions/${sessionData.id}/accept/${memberProfile.id}`;
          const declineLink = `${process.env.BACKEND_URL}/api/sessions/${sessionData.id}/decline/${memberProfile.id}`;

          const htmlContent = `
            <h2>New Study Session Scheduled</h2>
            <p><strong>Date/Time:</strong> ${start_at}</p>
            ${venue ? `<p><strong>Venue:</strong> ${venue}</p>` : ''}
            ${topic ? `<p><strong>Topic:</strong> ${topic}</p>` : ''}
            ${time_goal_minutes ? `<p><strong>Time goal:</strong> ${time_goal_minutes} mins</p>` : ''}
            ${content_goal ? `<p><strong>Content goal:</strong> ${content_goal}</p>` : ''}
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

          await sendEmailSafe(
            memberProfile.email,
            `New Study Session in your group`,
            htmlContent
          );
          
          // Create invite record
          await supabase.from("session_invites").insert({
            session_id: sessionData.id,
            user_id: memberProfile.id,
            status: "pending",
          });
        }
      } catch (err) {
        console.error(`Error processing member ${memberProfile.email}:`, err);
      }
    }

    console.log("Session creation and email processing completed");
    res.json({ session: sessionData });
    
  } catch (e) {
    console.error("Error in session creation:", e);
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
          // Updated: Use sendEmailSafe instead of transporter.sendMail
          await sendEmailSafe(
            creator.email,
            `Conflict: ${prof?.full_name} already booked`,
            `${prof?.full_name} has already accepted another session at ${session.start_at}.`
          );
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

