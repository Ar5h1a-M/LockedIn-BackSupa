import express from "express";
import supabase from "../utils/supabaseClient.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  const { email } = req.body;

  try {
    // check if user exists in Supabase `auth.users`
    const { data: user, error } = await supabase
      .from("users") // this is your *own* table if you made one
      .select("id")
      .eq("email", email)
      .single();

    if (error && error.code === "PGRST116") {
      return res.status(404).json({
        message: "Account does not exist, please sign up",
      });
    }

    res.json({ message: "Login successful", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

export default router;
