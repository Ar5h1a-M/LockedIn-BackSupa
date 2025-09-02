import { jest } from "@jest/globals";
import request from "supertest";

let app;
let supabaseMock;

beforeAll(async () => {
  // Mock Supabase client
  supabaseMock = {
    auth: {
      getUser: jest.fn()
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn()
          }))
        }))
      })),
      upsert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn()
        }))
      }))
    }))
  };

  jest.unstable_mockModule("@supabase/supabase-js", () => ({
    createClient: () => supabaseMock,
  }));

  const mod = await import("../src/server.js");
  app = mod.default || mod;
});

describe("Progress endpoints", () => {
  const mockUser = {
    id: "user123",
    email: "test@test.com",
    user_metadata: { full_name: "Test User" }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/progress", () => {
    it("should return 401 when unauthorized", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      const res = await request(app)
        .get("/api/progress");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("should return empty progress when user has no entries", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      supabaseMock.from.mockImplementation((table) => {
        if (table === "user_progress") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn().mockResolvedValue({
                    data: [],
                    error: null
                  })
                }))
              }))
            }))
          };
        }
        return {};
      });

      const res = await request(app)
        .get("/api/progress")
        .set("Authorization", "Bearer valid_token");

      expect(res.status).toBe(200);
      expect(res.body.entries).toEqual([]);
    });

    it("should return user progress entries", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const mockEntries = [
        {
          date: "2025-01-01",
          hours: 8,
          productivity: 8,
          notes: "Great day!"
        },
        {
          date: "2024-12-31",
          hours: 6,
          productivity: 7,
          notes: "Good progress"
        }
      ];

      supabaseMock.from.mockImplementation((table) => {
        if (table === "user_progress") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn().mockResolvedValue({
                    data: mockEntries,
                    error: null
                  })
                }))
              }))
            }))
          };
        }
        return {};
      });

      const res = await request(app)
        .get("/api/progress")
        .set("Authorization", "Bearer valid_token");

      expect(res.status).toBe(200);
      expect(res.body.entries).toEqual(mockEntries);
    });
  });

  describe("POST /api/progress", () => {
    it("should return 401 when unauthorized", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      const res = await request(app)
        .post("/api/progress")
        .send({ date: "2025-01-01", hours: 8 });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("should return 400 when required fields are missing", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const res = await request(app)
        .post("/api/progress")
        .set("Authorization", "Bearer valid_token")
        .send({ date: "2025-01-01" }); // missing hours

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("date and hours required");
    });

    it("should create progress entry successfully", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const newEntry = {
        date: "2025-01-01",
        hours: 8,
        productivity: 9,
        notes: "Productive day!"
      };

      supabaseMock.from.mockImplementation((table) => {
        if (table === "user_progress") {
          return {
            upsert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: newEntry,
                  error: null
                })
              }))
            }))
          };
        }
        return {};
      });

      const res = await request(app)
        .post("/api/progress")
        .set("Authorization", "Bearer valid_token")
        .send({
          date: "2025-01-01",
          hours: 8,
          productivity: 9,
          notes: "Productive day!"
        });

      expect(res.status).toBe(200);
      expect(res.body.entry).toEqual(newEntry);
    });

    it("should handle missing optional fields", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const minimalEntry = {
        date: "2025-01-01",
        hours: 5,
        productivity: null,
        notes: null
      };

      supabaseMock.from.mockImplementation((table) => {
        if (table === "user_progress") {
          return {
            upsert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: minimalEntry,
                  error: null
                })
              }))
            }))
          };
        }
        return {};
      });

      const res = await request(app)
        .post("/api/progress")
        .set("Authorization", "Bearer valid_token")
        .send({
          date: "2025-01-01",
          hours: 5
        });

      expect(res.status).toBe(200);
      expect(res.body.entry.date).toBe("2025-01-01");
      expect(res.body.entry.hours).toBe(5);
    });
  });
});