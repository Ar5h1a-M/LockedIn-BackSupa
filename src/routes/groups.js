// routes/groups.js
/**
 * @openapi
 * /api/groups:
 *   post:
 *     summary: Create a group
 *     tags: [Groups]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               module: { type: string }
 *     responses:
 *       200: { description: Group created }
 *       401: { description: Unauthorized }
 */

/**
 * @openapi
 * /api/groups:
 *   get:
 *     summary: List groups I own or belong to
 *     tags: [Groups]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Groups returned }
 *       401: { description: Unauthorized }
 */

/**
 * @openapi
 * /api/group-invitations:
 *   post:
 *     summary: Send group invites (owner only)
 *     tags: [Groups]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [group_id, recipient_ids]
 *             properties:
 *               group_id: { type: integer }
 *               recipient_ids: { type: array, items: { type: string } }
 *     responses:
 *       200: { description: Invitations sent }
 *       401: { description: Unauthorized }
 *       403: { description: Only owner can invite }
 */

/**
 * @openapi
 * /api/group-invitations/received:
 *   get:
 *     summary: View my received group invites
 *     tags: [Groups]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Invitations returned }
 *       401: { description: Unauthorized }
 */

/**
 * @openapi
 * /api/group-invitations/{id}:
 *   put:
 *     summary: Accept/decline a group invite
 *     tags: [Groups]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: integer }
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [accepted, declined] }
 *     responses:
 *       200: { description: Updated }
 *       400: { description: Invalid status or already handled }
 *       401: { description: Unauthorized }
 *       403: { description: Not authorized }
 *       404: { description: Invite not found }
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

/** Create a group (+ add owner to members) */
router.post("/groups", async (req, res, next) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const { name, module } = req.body || {};
    if (!name) return res.status(400).json({ error: "Group name required" });

    const { data: g, error: gErr } = await supabase
      .from("groups")
      .insert([{ owner_id: user.id, name, module }])
      .select("id, owner_id, name, module, created_at")
      .single();
    if (gErr) throw gErr;

    await supabase.from("group_members").insert([{ group_id: g.id, user_id: user.id, role: "owner" }]);
    res.json({ group: g });
  } catch (e) { next(e); }
});

/** List my groups (owned or member) */
router.get("/groups", async (req, res, next) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // groups I own
    const { data: own, error: oErr } = await supabase
      .from("groups")
      .select("id, owner_id, name, module, created_at")
      .eq("owner_id", user.id);
    if (oErr) throw oErr;

    // groups I'm a member of (including owner again; we'll dedupe)
    const { data: mem, error: mErr } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id);
    if (mErr) throw mErr;

    const ids = Array.from(new Set([...(own||[]).map(g => g.id), ...(mem||[]).map(x => x.group_id)]));
    if (!ids.length) return res.json({ groups: [] });

    const { data: groups, error: gErr } = await supabase
      .from("groups")
      .select("id, owner_id, name, module, created_at")
      .in("id", ids);
    if (gErr) throw gErr;

    res.json({ groups });
  } catch (e) { next(e); }
});

/** Send group invites to many friends */
router.post("/group-invitations", async (req, res, next) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { group_id, recipient_ids } = req.body || {};
    if (!group_id || !Array.isArray(recipient_ids) || recipient_ids.length === 0) {
      return res.status(400).json({ error: "group_id and recipient_ids[] required" });
    }

    // Owner or member can invite; up to you. Here: only owner can invite.
    const { data: ownerRow, error: ownErr } = await supabase
      .from("groups").select("owner_id").eq("id", group_id).single();
    if (ownErr) throw ownErr;
    if (!ownerRow || ownerRow.owner_id !== user.id) return res.status(403).json({ error: "Only owner can invite" });

    const rows = recipient_ids.map(rid => ({
      group_id,
      sender_id: user.id,
      recipient_id: rid,
      status: "pending",
    }));
    const { error } = await supabase.from("group_invitations").insert(rows);
    if (error) throw error;

    res.json({ message: "Invitations sent" });
  } catch (e) { next(e); }
});

/** View received group invites */
router.get("/group-invitations/received", async (req, res, next) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { data: invites, error } = await supabase
      .from("group_invitations")
      .select("id, group_id, sender_id, recipient_id, status, sent_at")
      .eq("recipient_id", user.id)
      .order("sent_at", { ascending: false });
    if (error) throw error;

    // join group names
    const gIds = [...new Set(invites.map(i => i.group_id))];
    let groupById = {};
    if (gIds.length) {
      const { data: gs, error: gErr } = await supabase
        .from("groups").select("id, name, module, owner_id").in("id", gIds);
      if (gErr) throw gErr;
      groupById = Object.fromEntries(gs.map(g => [g.id, g]));
    }
    res.json({
      invitations: invites.map(i => ({
        ...i,
        group_name: groupById[i.group_id]?.name || null,
        group_module: groupById[i.group_id]?.module || null,
        group_owner_id: groupById[i.group_id]?.owner_id || null
      }))
    });
  } catch (e) { next(e); }
});

/** Accept/Decline group invite */
router.put("/group-invitations/:id", async (req, res, next) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const { status } = req.body || {};
    if (!["accepted","declined"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const { data: inv, error: fErr } = await supabase
      .from("group_invitations")
      .select("group_id, recipient_id, status")
      .eq("id", id).single();
    if (fErr) throw fErr;
    if (!inv) return res.status(404).json({ error: "Invite not found" });
    if (inv.recipient_id !== user.id) return res.status(403).json({ error: "Not authorized" });
    if (inv.status !== "pending") return res.status(400).json({ error: "Already handled" });

    const { error: uErr } = await supabase
      .from("group_invitations")
      .update({ status })
      .eq("id", id);
    if (uErr) throw uErr;

    if (status === "accepted") {
      // add to group_members
      await supabase.from("group_members")
        .upsert([{ group_id: inv.group_id, user_id: user.id, role: "member" }],
                { onConflict: "group_id,user_id" });
    }
    res.json({ message: `Group invite ${status}` });
  } catch (e) { next(e); }
});

export default router;
