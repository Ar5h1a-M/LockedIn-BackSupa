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
      return res.status(401).json({ error: "User not found. Please sign up first." });
    }

    // If user exists in auth.users, allow login
    return res.json({
      message: "Login successful",
      user: { id: user.id, email: user.email, full_name: user.user_metadata?.full_name ?? null }
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// SIGNUP: accept new users from OAuth
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
    if (error || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // For OAuth (Google), the user is automatically created in auth.users
    // We can add additional logic here if needed (like creating a profile record)
    
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