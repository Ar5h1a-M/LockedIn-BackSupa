// src/routes/auth.js
import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

// Use service role key (server only)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// LOGIN: must exist in auth.users
router.post("/login", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const accessToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!accessToken) {
      return res.status(400).json({ error: "Missing access token" });
    }

    // Verify token → maps directly to auth.users
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (error || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // If user exists in auth.users, allow through
    return res.json({
      message: "Login successful",
      user: { id: user.id, email: user.email, full_name: user.user_metadata?.full_name ?? null }
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// SIGNUP: user must *not* already exist in auth.users
router.post("/signup", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const accessToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!accessToken) {
      return res.status(400).json({ error: "Missing access token" });
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    if (!user) {
      return res.status(403).json({ error: "No Supabase user found. Please try Google sign-up again." });
    }

    // If already exists in auth.users → block
    // (getUser guarantees user exists in auth.users if no error)
    if (user) {
      return res.status(400).json({ error: "User already exists" });
    }

    // In Supabase, OAuth (Google) already inserts into auth.users automatically
    // So we just return success
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
