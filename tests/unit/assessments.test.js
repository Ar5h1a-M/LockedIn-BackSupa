import { jest } from "@jest/globals";
import request from "supertest";

let app;
let supabaseMock;

beforeAll(async () => {
  // Mock Supabase client - following the exact pattern from your working invitations test
  supabaseMock = {
    auth: {
      getUser: jest.fn()
    },
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn()
        }))
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          order: jest.fn()
        })),
        in: jest.fn(),
        gte: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn()
          }))
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn()
      })),
      upsert: jest.fn()
    }))
  };

  jest.unstable_mockModule("@supabase/supabase-js", () => ({
    createClient: () => supabaseMock,
  }));

  const mod = await import("../../src/server.js");
  app = mod.default || mod;
});

describe("Assessments endpoints", () => {
  const mockUser = {
    id: "user123",
    email: "test@test.com",
    user_metadata: { full_name: "Test User" }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/assessments", () => {
    it("should return 401 when unauthorized", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      const res = await request(app)
        .post("/api/assessments")
        .send({ name: "Math Test", scope: "Chapter 1", test_date: "2024-12-01" });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("should create assessment successfully", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const mockAssessment = {
        id: 1,
        user_id: mockUser.id,
        name: "Math Test",
        scope: "Chapter 1",
        test_date: "2024-12-01T00:00:00Z"
      };

      supabaseMock.from.mockImplementation((table) => {
        if (table === "tests") {
          return {
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: mockAssessment,
                  error: null
                })
              }))
            }))
          };
        }
        return {};
      });

      const res = await request(app)
        .post("/api/assessments")
        .set("Authorization", "Bearer valid_token")
        .send({ name: "Math Test", scope: "Chapter 1", test_date: "2024-12-01" });

      expect(res.status).toBe(200);
      expect(res.body.test).toEqual(mockAssessment);
    });

    it("should handle database errors when creating assessment", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      supabaseMock.from.mockImplementation((table) => {
        if (table === "tests") {
          return {
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: new Error("Database error")
                })
              }))
            }))
          };
        }
        return {};
      });

      const res = await request(app)
        .post("/api/assessments")
        .set("Authorization", "Bearer valid_token")
        .send({ name: "Math Test", scope: "Chapter 1", test_date: "2024-12-01" });

      expect(res.status).toBe(500);
    });
  });

  describe("GET /api/upcoming", () => {
    it("should return 401 when unauthorized", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      const res = await request(app)
        .get("/api/upcoming");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("should return empty array when no upcoming assessments", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      supabaseMock.from.mockImplementation((table) => {
        if (table === "tests") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                gte: jest.fn(() => ({
                  order: jest.fn(() => ({
                    limit: jest.fn().mockResolvedValue({
                      data: [],
                      error: null
                    })
                  }))
                }))
              }))
            }))
          };
        }
        return {};
      });

      const res = await request(app)
        .get("/api/upcoming")
        .set("Authorization", "Bearer valid_token");

      expect(res.status).toBe(200);
      expect(res.body.tests).toEqual([]);
    });

    it("should return upcoming assessments", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const mockTests = [
        {
          id: 1,
          user_id: mockUser.id,
          name: "Math Final",
          scope: "All chapters",
          test_date: "2024-12-15T10:00:00Z"
        },
        {
          id: 2,
          user_id: mockUser.id,
          name: "Physics Quiz",
          scope: "Mechanics",
          test_date: "2024-12-20T14:00:00Z"
        }
      ];

      supabaseMock.from.mockImplementation((table) => {
        if (table === "tests") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                gte: jest.fn(() => ({
                  order: jest.fn(() => ({
                    limit: jest.fn().mockResolvedValue({
                      data: mockTests,
                      error: null
                    })
                  }))
                }))
              }))
            }))
          };
        }
        return {};
      });

      const res = await request(app)
        .get("/api/upcoming")
        .set("Authorization", "Bearer valid_token");

      expect(res.status).toBe(200);
      expect(res.body.tests).toEqual(mockTests);
    });

    it("should handle database errors when fetching assessments", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      supabaseMock.from.mockImplementation((table) => {
        if (table === "tests") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                gte: jest.fn(() => ({
                  order: jest.fn(() => ({
                    limit: jest.fn().mockResolvedValue({
                      data: null,
                      error: new Error("Database error")
                    })
                  }))
                }))
              }))
            }))
          };
        }
        return {};
      });

      const res = await request(app)
        .get("/api/upcoming")
        .set("Authorization", "Bearer valid_token");

      expect(res.status).toBe(500);
    });
  });
});