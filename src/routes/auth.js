import express from "express";
import supabase from "../utils/supabaseClient.js";

const router = express.Router();

/**
 * POST /api/auth/login
 *
 * Frontend sends the Supabase access token (from Google OAuth or email/password)
 * in the Authorization header: "Bearer <access_token>".
 *
 * We verify the token with Supabase, confirm the user exists in auth.users,
 * and (optionally) upsert a public users row for convenience.
 */
router.post("/login", async (req, res) => {
  try {
    // Try Authorization header first, fallback to body.access_token
    const authHeader = req.headers.authorization || "";
    const access_token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : req.body?.access_token;

    if (!access_token) {
      return res.status(400).json({ error: "Missing access token" });
    }

    // Verify token with Supabase and get user
    const { data: userRes, error: getUserErr } = await supabase.auth.getUser(access_token);
    if (getUserErr || !userRes?.user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const user = userRes.user; // { id, email, user_metadata, ... }

    // (Optional) ensure there is a row in your public users table
    // Adjust table/columns to your schema (profiles/users).
    // This requires RLS policy or service role on your server client.
    const { error: upsertErr } = await supabase
      .from("users")
      .upsert(
        {
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        },
        { onConflict: "id" }
      );

    if (upsertErr) {
      // Not fatal for login; log and continue.
      console.error("Upsert users error:", upsertErr);
    }

    // OK
    return res.json({
      message: "Login verified",
      user: {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

/**
 * POST /api/auth/signup
 * Creates a Supabase auth user (email/password) and (optionally) inserts
 * a row in public users table.
 *
 * Body: { email, password, full_name? }
 */
router.post("/signup", async (req, res) => {
  const { email, password, full_name } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || null },
    });

    if (error) throw error;

    const created = data?.user;
    if (created?.id) {
      // Optional insert in your public users table
      const { error: insertErr } = await supabase.from("users").insert([
        {
          id: created.id,
          email: created.email,
          full_name: full_name || null,
        },
      ]);
      if (insertErr) console.error("Insert users error:", insertErr);
    }

    return res.json({ message: "User created successfully", user: created });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Signup failed." });
  }
});

export default router;