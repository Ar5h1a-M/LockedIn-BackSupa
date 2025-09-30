// middleware/auth.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function getUserOrService(req) {
  // Option A: API Key
  const apiKey = req.headers["lock-api-key"];
  if (apiKey && apiKey === process.env.SERVICE_API_KEY) {
    return { id: "service", email: "service@internal" }; // fake user
  }

  // Option B: Bearer token (existing Supabase auth)
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error) throw error;
  return data?.user || null;
}

