// src/routes/auth.js
/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Verify Supabase access token; ensure user has a profile
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Login ok }
 *       400: { description: Missing access token }
 *       401: { description: Invalid/expired token or user has not signed up }
 */

/**
 * @openapi
 * /api/auth/signup:
 *   post:
 *     summary: Create a profile for the authenticated Supabase user
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [degree, interest]
 *             properties:
 *               degree: { type: string }
 *               modules: { type: array, items: { type: string } }
 *               interest: { type: string }
 *     responses:
 *       200: { description: Signup successful }
 *       400: { description: Missing required fields or token }
 *       401: { description: Invalid/expired token }
 *       500: { description: Failed to create profile }
 */

import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

// Use service role key (server only)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// LOGIN: Check if user exists and has completed signup
router.post("/login", async (req, res) => {
  try {
    console.log("Login endpoint hit");
    
    const authHeader = req.headers.authorization || "";
    const accessToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!accessToken) {
      console.log("No access token provided");
      return res.status(400).json({ error: "Missing access token" });
    }

    // Verify token → maps directly to auth.users
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    console.log("Auth user lookup:", { user: user?.id, error });

    if (error || !user) {
      console.log("Invalid token or no user");
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Check if user has a profile record (indicates they completed signup)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    console.log("Profile lookup:", { profile: profile?.id, error: profileError });

    if (profileError && profileError.code === 'PGRST116') {
      // Profile doesn't exist - user needs to sign up first
      console.log("No profile found, deleting auth user");
      await supabase.auth.admin.deleteUser(user.id); 
      return res.status(401).json({ error: "User not found. Please sign up first." });
    }

    if (profileError) {
      console.error("Profile check error:", profileError);
      return res.status(500).json({ error: "Database error" });
    }

    // User exists and has completed signup
    console.log("Login successful for user:", user.id);
    return res.json({
      message: "Login successful",
      user: { id: user.id, email: user.email, full_name: user.user_metadata?.full_name ?? null }
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// SIGNUP: Create profile for new OAuth users
router.post("/signup", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const accessToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!accessToken) return res.status(400).json({ error: "Missing access token" });

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return res.status(401).json({ error: "Invalid or expired token" });

    const { degree, modules, interest } = req.body;

    // Validate required fields
    if (!degree || !interest) {
      return res.status(400).json({ error: "Degree and interest are required" });
    }

    // Make sure modules is an array of non-empty strings
    const modulesArray = Array.isArray(modules) ? modules.filter(m => m.trim() !== "") : [];

    // Insert into Supabase
    const { error: insertError } = await supabase
      .from("profiles")
      .insert([
        {
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name ?? null,
          degree,
          modules: modulesArray, // must match column type in Supabase
          interest,
          created_at: new Date().toISOString(),
        },
      ]);

    if (insertError) {
      console.error("Insert error:", insertError);
      return res.status(500).json({ error: "Failed to create user profile" });
    }

    return res.json({ message: "Signup successful" });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// Add this to your backend auth.js
router.post("/check-profile", async (req, res) => {
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

    // Check if user has a profile record
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (profileError && profileError.code === 'PGRST116') {
      // Profile doesn't exist
      return res.status(404).json({ error: "Profile not found" });
    }

    if (profileError) {
      return res.status(500).json({ error: "Database error" });
    }

    // Profile exists
    return res.json({ exists: true, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error("Check profile error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

export default router;