// src/routes/auth.js
import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

/**
 * IMPORTANT:
 * Use the service role key on the server so we can:
 *  - verify tokens (auth.getUser)
 *  - read your app tables regardless of RLS
 *
 * Never expose SERVICE_ROLE in the browser.
 */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);

/**
 * POST /api/auth/login
 * Frontend sends the Supabase access token (from Google OAuth)
 *   Authorization: Bearer <access_token>
 * We verify it, then ensure the user already exists in public.users.
 * If not present, we DENY (403) instead of creating them.
 */
router.post("/login", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const accessToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : (req.body && req.body.access_token) || null;

    if (!accessToken) {
      return res.status(400).json({ error: "Missing access token" });
    }

    // 1) Verify token with Supabase
    const { data: userRes, error: getUserErr } = await supabase.auth.getUser(accessToken);
    if (getUserErr || !userRes || !userRes.user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    const user = userRes.user; // { id, email, user_metadata, ... }

    // 2) Enforce: must already exist in your app's users table
    const { data: existing, error: selErr } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (selErr) {
      console.error("users select error:", selErr);
      return res.status(500).json({ error: "Database error" });
    }

    if (!existing) {
      // Unknown account → block
      return res.status(403).json({ error: "Account not founf, Please sign up" });
    }

    // (Optional) Allowlist or domain check:
    // if (!user.email || !user.email.endsWith("@youruni.ac.za")) {
    //   return res.status(403).json({ error: "Email domain not allowed" });
    // }

    return res.json({
      message: "Login verified",
      user: {
        id: user.id,
        email: user.email || null,
        full_name:
          (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) ||
          null,
      },
    });
  } catch (err) {
    console.error("Login verify error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/signup", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const accessToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : (req.body && req.body.access_token) || null;

    if (!accessToken) {
      return res.status(400).json({ error: "Missing access token" });
    }

    // 1) Verify token with Supabase
    const { data: userRes, error: getUserErr } = await supabase.auth.getUser(accessToken);
    if (getUserErr || !userRes?.user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    const user = userRes.user; // comes from Supabase auth.users

    // 2) Check if user already exists in your app's users table
    const { data: existing, error: selErr } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (selErr) {
      console.error("users select error:", selErr);
      return res.status(500).json({ error: "Database error" });
    }

    if (existing) {
      return res.json({
        message: "User already registered",
        user: { id: user.id, email: user.email, full_name: user.user_metadata?.full_name ?? null }
      });
    }

    // 3) Insert user into your app's users table
    const { error: insErr } = await supabase
      .from("users")
      .insert([{
        id: user.id, // matches auth.users id
        email: user.email,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        created_at: new Date().toISOString()
      }]);

    if (insErr) {
      console.error("users insert error:", insErr);
      return res.status(500).json({ error: "Failed to create user" });
    }

    return res.json({
      message: "Signup successful",
      user: { id: user.id, email: user.email, full_name: user.user_metadata?.full_name ?? null }
    });

  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

export default router;