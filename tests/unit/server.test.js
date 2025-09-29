
import { jest } from "@jest/globals";

import request from "supertest";

let app; // we’ll import it later, after env + mocks

beforeAll(async () => {
  // ✅ Set fake env before importing anything that uses createClient
  process.env.SUPABASE_URL = "http://localhost:54321";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test_service_role_key";

  // ✅ Mock Supabase client before importing app
  jest.mock("@supabase/supabase-js", () => ({
    createClient: () => ({
      auth: {
        signInWithPassword: jest.fn(),
        signUp: jest.fn(),
        getSession: jest.fn(),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn(),
    }),
  }));

  // ✅ Dynamically import server AFTER mocks + env vars are in place
  const mod = await import("../../src/server.js");
  app = mod.default || mod; // handle both ES default export and CommonJS
});

describe("Health endpoints", () => {
  it("GET / returns ok:true", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("GET /health returns ok:true", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
