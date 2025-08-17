import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "LockedIn backend", ts: Date.now() });
});

console.log("Loading auth routes..."); // Add this debug line
app.use("/api/auth", authRoutes);
console.log("Auth routes loaded successfully!"); // Add this debug line

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});