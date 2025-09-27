import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { buildOpenApiSpec } from "./swagger.js";

import authRoutes from "./routes/auth.js";
import searchRoutes from "./routes/search.js";
import invitationRoutes from "./routes/invitations.js";
import profileRoutes from "./routes/profile.js";
import groupRoutes from "./routes/groups.js";
import sessionsRoutes from "./routes/sessions.js";
import progressRoutes from "./routes/progress.js";
import assessmentsRoutes from "./routes/assessments.js";


const app = express();

// CORS: allow Authorization header so partners can auth from Swagger UI
app.use(
  cors({
    origin: "*",
    methods: "GET,POST,PUT,DELETE,OPTIONS",
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

// Health check root (keep your current behavior)
app.get("/", (_req, res) => {
  res.json({ ok: true, service: "LockedIn backend", ts: Date.now() });
});

// Optional: separate health path too
app.get("/health", (_req, res) => res.json({ ok: true }));

console.log("Supabase URL:", process.env.SUPABASE_URL);

// ---------------- Swagger UI ----------------
const openapiSpec = buildOpenApiSpec();
app.get("/openapi.json", (_req, res) => res.json(openapiSpec));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec, { explorer: true }));
// -------------------------------------------

// Mount routes
console.log("Loading routes...");
app.use("/api/auth", authRoutes);     // -> /api/auth/login, /api/auth/signup
app.use("/api", searchRoutes);        // -> /api/search, /api/invite
app.use("/api", invitationRoutes);    // -> /api/invitations/received, /api/invitations/sent, /api/invitations/:id
app.use("/api", profileRoutes);       // -> /api/profile, /api/friends
app.use("/api", groupRoutes);         // -> /api/groups/*, /api/group-invitations/*
app.use("/api", sessionsRoutes);      // -> /api/groups/:groupId/sessions*, /api/groups/:groupId/messages*
app.use("/api", progressRoutes);      // -> /api/progress
app.use("/api", assessmentsRoutes);      
     

console.log("Routes loaded successfully!");

// Error handler
app.use((err, req, res, _next) => {
  console.error("UNHANDLED ERROR:", err);
  res.status(500).json({ error: err?.message || "Internal Server Error" });
});


if (process.env.NODE_ENV !== "test") {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`Backend on :${PORT}`));
}

export default app;

