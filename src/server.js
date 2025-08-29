import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.js";
import searchRoutes from "./routes/search.js";
import invitationRoutes from "./routes/invitations.js";
import profileRoutes from "./routes/profile.js";
import groupRoutes from "./routes/groups.js";
import sessionsRoutes from "./routes/sessions.js";
import progressRoutes from "./routes/progress.js";


const app = express();
app.use(cors());
app.use(express.json());

// Health check root
app.get("/", (_req, res) => {
  res.json({ ok: true, service: "LockedIn backend", ts: Date.now() });
});

console.log("Supabase URL:", process.env.SUPABASE_URL);

// Mount routes
console.log("Loading routes...");
app.use("/api/auth", authRoutes);
app.use("/api", searchRoutes);        // search.js defines /search and /invite
app.use("/api/", invitationRoutes); // invitations.js defines /received, /sent, PUT /:id
app.use("/api", profileRoutes);      // /api/profile, /api/profile/update, /api/friends
app.use("/api", groupRoutes);        // /api/groups/* and /api/group-invitations/*
app.use("/api", sessionsRoutes);   // /api/groups/:groupId/sessions*, /api/groups/:groupId/messages*
app.use("/api", progressRoutes);   // /api/progress (GET/POST)
console.log("Routes loaded successfully!");

// ... your existing imports and app setup ...

// Put this JUST ABOVE app.listen(...)
app.use((err, req, res, _next) => {
  console.error("UNHANDLED ERROR:", err);
  res.status(500).json({ error: err?.message || "Internal Server Error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend on :${PORT}`));

