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
    sendEmail: async (to, subject, html, text, emailType = 'invitation', templateData = {}) => {
      console.log("[Mock email] sendEmail called to:", to, "Type:", emailType);
      return Promise.resolve({ 
        success: true,
        to: to,
        subject: subject,
        emailType: emailType
      });
    }
  };
} else {
  // Production: Use EmailJS with two templates
  emailService = {
    sendEmail: async (to, subject, html, text, emailType = 'invitation', templateData = {}) => {
      try {
        console.log(`📧 Sending ${emailType} email to: ${to}`);
        
        // Choose template based on email type
        const templateId = emailType === 'conflict' 
          ? process.env.EMAILJS_CONFLICT_TEMPLATE_ID 
          : process.env.EMAILJS_INVITATION_TEMPLATE_ID;
        
        const templateParams = {
          to_email: to,
          subject: subject,
          name: templateData.recipient_name || to.split('@')[0],
          session_time: templateData.session_time || '',
          venue: templateData.venue || '',
          topic: templateData.topic || 'Group Study Session',
          time_goal: templateData.time_goal || '',
          content_goal: templateData.content_goal || '',
          organizer: templateData.organizer || 'A group member',
          action_url: templateData.accept_link || '',
          support_url: templateData.decline_link || '',
          conflict_message: templateData.conflict_message || '',
          student_name: templateData.student_name || ''
        };

        const emailjsResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            service_id: process.env.EMAILJS_SERVICE_ID,
            template_id: templateId,
            user_id: process.env.EMAILJS_USER_ID,
            template_params: templateParams
          })
        });

        if (!emailjsResponse.ok) {
          const errorText = await emailjsResponse.text();
          throw new Error(`EmailJS API error: ${emailjsResponse.status} - ${errorText}`);
        }

        console.log(`✅ ${emailType} email sent successfully to: ${to}`);
        return { 
          success: true, 
          service: 'emailjs',
          emailType: emailType
        };
        
      } catch (error) {
        console.error(`❌ Failed to send ${emailType} email to ${to}:`, error.message);
        return { 
          error: `EmailJS failed: ${error.message}`,
          emailType: emailType
        };
      }
    }
  };
}

// Safe email function that works in both test and production
async function sendEmailSafe(to, subject, html, text, emailType = 'invitation', templateData = {}) {
  return await emailService.sendEmail(to, subject, html, text, emailType, templateData);
}

// Export for tests
export { emailService };

// 🆕 IMMEDIATE TEST ROUTE: EmailJS Test
router.get("/emailJS-test", async (req, res) => {
  try {
    const testEmail = req.query.email || 'njam.arshia@gmail.com';
    const testType = req.query.type || 'invitation'; // 'invitation' or 'conflict'
    
    console.log(`🧪 Testing EmailJS with ${testType} template to: ${testEmail}`);
    
    let templateData;
    
    if (testType === 'conflict') {
      // Test conflict template
      templateData = {
        recipient_name: "Test Creator",
        session_time: new Date().toLocaleString(),
        conflict_message: "Test Student has already accepted another session at this time.",
        student_name: "Test Student"
      };
    } else {
      // Test invitation template
      templateData = {
        recipient_name: "Test User", 
        session_time: new Date().toLocaleString(),
        venue: "Wits Library",
        topic: "Computer Science Study Group",
        time_goal: "120",
        content_goal: "Complete Chapter 5 exercises",
        organizer: "Test Organizer",
        accept_link: "https://courses.ms.wits.ac.za/accept-test",
        decline_link: "https://courses.ms.wits.ac.za/decline-test"
      };
    }
    
    const result = await sendEmailSafe(
      testEmail,
      testType === 'conflict' ? '⚠️ Test Conflict Alert' : '📚 Test Session Invitation',
      '', // HTML handled by template
      `Test ${testType} email`, // Plain text fallback
      testType,
      templateData
    );
    
    res.json({ 
      success: true, 
      message: `EmailJS ${testType} test completed for ${testEmail}`,
      testDetails: {
        email: testEmail,
        type: testType,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        templateUsed: testType === 'conflict' ? 'Conflict Template' : 'Invitation Template'
      },
      result
    });
    
  } catch (error) {
    console.error('❌ EmailJS test failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      note: 'Check your EmailJS environment variables: SERVICE_ID, TEMPLATE_IDS, USER_ID'
    });
  }
});

// 🆕 Test both templates at once
router.get("/emailJS-test-both", async (req, res) => {
  try {
    const testEmail = req.query.email || 'njam.arshia@gmail.com';
    
    console.log(`🧪 Testing both EmailJS templates to: ${testEmail}`);
    
    const results = [];
    
    // Test invitation template
    const invitationResult = await sendEmailSafe(
      testEmail,
      '📚 Test Session Invitation',
      '',
      'Test invitation email',
      'invitation',
      {
        recipient_name: "Test User",
        session_time: new Date().toLocaleString(),
        venue: "Wits Library",
        topic: "Computer Science Study Group", 
        time_goal: "120",
        content_goal: "Complete Chapter 5",
        organizer: "Test Organizer",
        accept_link: "https://courses.ms.wits.ac.za/accept-test",
        decline_link: "https://courses.ms.wits.ac.za/decline-test"
      }
    );
    results.push({ type: 'invitation', result: invitationResult });
    
    // Wait 2 seconds between emails
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test conflict template  
    const conflictResult = await sendEmailSafe(
      testEmail,
      '⚠️ Test Conflict Alert',
      '',
      'Test conflict email', 
      'conflict',
      {
        recipient_name: "Test Creator",
        session_time: new Date().toLocaleString(),
        conflict_message: "Test Student has a scheduling conflict.",
        student_name: "Test Student"
      }
    );
    results.push({ type: 'conflict', result: conflictResult });
    
    res.json({ 
      success: true, 
      message: `Both EmailJS templates tested for ${testEmail}`,
      results,
      summary: {
        invitation: invitationResult.success ? '✅ Success' : '❌ Failed',
        conflict: conflictResult.success ? '✅ Success' : '❌ Failed'
      }
    });
    
  } catch (error) {
    console.error('❌ EmailJS both-templates test failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/** Create a session (planner) - Updated for EmailJS templates */
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
              `⚠️ Scheduling Conflict Alert`,
              '', // HTML handled by template
              `Conflict: ${memberProfile.full_name} has already accepted another session at ${start_at}.`,
              'conflict',
              {
                recipient_name: creator.full_name,
                session_time: start_at,
                conflict_message: `${memberProfile.full_name} has already accepted another session at this time.`,
                student_name: memberProfile.full_name
              }
            );
          }
        } else {
          // Send RSVP email using EmailJS invitation template
          const acceptLink = `https://${process.env.BACKEND_URL}/api/sessions/${sessionData.id}/accept/${memberProfile.id}`;
          const declineLink = `https://${process.env.BACKEND_URL}/api/sessions/${sessionData.id}/decline/${memberProfile.id}`;

          await sendEmailSafe(
            memberProfile.email,
            `📚 Study Session: ${topic || 'Group Study'}`,
            '', // HTML handled by template
            `You've been invited to a study session on ${start_at}. Accept: ${acceptLink} or Decline: ${declineLink}`,
            'invitation',
            {
              recipient_name: memberProfile.full_name,
              session_time: start_at,
              venue: venue || '',
              topic: topic || 'Group Study Session',
              time_goal: time_goal_minutes || '',
              content_goal: content_goal || '',
              organizer: user.user_metadata?.full_name || 'A group member',
              accept_link: acceptLink,
              decline_link: declineLink
            }
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
  res.send("✅ You've accepted the session!");
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
  res.send("❌ You've declined the session.");
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
          await sendEmailSafe(
            creator.email,
            `⚠️ Scheduling Conflict Alert`,
            '', // HTML handled by template
            `Conflict: ${prof?.full_name} cannot accept your session due to scheduling conflict.`,
            'conflict',
            {
              recipient_name: creator.full_name,
              session_time: session.start_at,
              conflict_message: `${prof?.full_name} cannot accept your session due to existing commitment.`,
              student_name: prof?.full_name || 'A student'
            }
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

