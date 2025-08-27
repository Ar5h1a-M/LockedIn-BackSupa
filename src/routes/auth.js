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
    console.log(degree);

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    if (existingProfile) {
      return res.status(400).json({ error: "User already exists. Please login instead." });
    }

    // Insert new profile with extra columns
    const { error: insertError } = await supabase
      .from("profiles")
      .insert([
        {
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name ?? null,
          degree,
          modules: modulesArray, // works if the column is text[]
          interest,
          created_at: new Date().toISOString(),
        },
      ]);

    if (insertError) return res.status(500).json({ error: "Failed to create user profile" });

    return res.json({ message: "Signup successful" });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});


export default router;