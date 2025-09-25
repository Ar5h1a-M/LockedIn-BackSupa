import { jest } from "@jest/globals";
import request from "supertest";

let app;
let supabaseMock;

beforeAll(async () => {
  // Mock Supabase client
  supabaseMock = {
    auth: { getUser: jest.fn() },
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn()
        }))
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          gte: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn()
            }))
          }))
        }))
      }))
    }))
  };

  jest.unstable_mockModule("@supabase/supabase-js", () => ({
    createClient: () => supabaseMock
  }));

  const mod = await import("../src/server.js"); // your express app
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
      supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

      const res = await request(app)
        .post("/api/assessments")
        .send({ name: "Test 1", test_date: "2025-01-01" });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("should create a new assessment", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });

      const mockTest = { id: "test123", name: "Test 1", scope: "Math", test_date: "2025-01-01", user_id: mockUser.id };

      supabaseMock.from.mockImplementation((table) => {
        if (table === "tests") {
          return {
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({ data: mockTest, error: null })
              }))
            }))
          };
        }
        return {};
      });

      const res = await request(app)
        .post("/api/assessments")
        .set("Authorization", "Bearer valid_token")
        .send({ name: "Test 1", scope: "Math", test_date: "2025-01-01" });

      expect(res.status).toBe(200);
      expect(res.body.test).toMatchObject({ id: "test123", name: "Test 1", scope: "Math" });
    });
  });

  describe("GET /api/assessments/upcoming", () => {
    it("should return 401 when unauthorized", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

      const res = await request(app).get("/api/assessments/upcoming");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("should return upcoming assessments", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });

      const mockTests = [
        { id: "test1", name: "Math Test", test_date: "2025-01-01", user_id: mockUser.id },
        { id: "test2", name: "Science Test", test_date: "2025-02-01", user_id: mockUser.id }
      ];

      supabaseMock.from.mockImplementation((table) => {
        if (table === "tests") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                gte: jest.fn(() => ({
                  order: jest.fn(() => ({
                    limit: jest.fn().mockResolvedValue({ data: mockTests, error: null })
                  }))
                }))
              }))
            }))
          };
        }
        return {};
      });

      const res = await request(app)
        .get("/api/assessments/upcoming")
        .set("Authorization", "Bearer valid_token");

      expect(res.status).toBe(200);
      expect(res.body.tests).toHaveLength(2);
      expect(res.body.tests[0].name).toBe("Math Test");
    });
  });
});
