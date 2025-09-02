import { jest } from "@jest/globals";
import request from "supertest";

let app;
let supabaseMock;

beforeAll(async () => {
  // Mock Supabase client
  supabaseMock = {
    auth: {
      getUser: jest.fn(),
      admin: {
        deleteUser: jest.fn()
      }
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn()
        }))
      })),
      insert: jest.fn()
    }))
  };

  jest.unstable_mockModule("@supabase/supabase-js", () => ({
    createClient: () => supabaseMock,
  }));

  const mod = await import("../src/server.js");
  app = mod.default || mod;
});

describe("Auth endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/auth/login", () => {
    it("should return 400 when no authorization header is provided", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Missing access token");
    });

    it("should return 401 when token is invalid", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Invalid token" }
      });

      const res = await request(app)
        .post("/api/auth/login")
        .set("Authorization", "Bearer invalid_token")
        .send({});

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid or expired token");
    });

    it("should return 401 when user has no profile (needs signup)", async () => {
      const mockUser = {
        id: "user123",
        email: "test@test.com",
        user_metadata: { full_name: "Test User" }
      };

      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      // Mock profile lookup to return "not found" error
      const profileQuery = {
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }
        })
      };
      
      supabaseMock.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue(profileQuery)
        })
      });

      supabaseMock.auth.admin.deleteUser.mockResolvedValue({ error: null });

      const res = await request(app)
        .post("/api/auth/login")
        .set("Authorization", "Bearer valid_token")
        .send({});

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("User not found. Please sign up first.");
      expect(supabaseMock.auth.admin.deleteUser).toHaveBeenCalledWith("user123");
    });

    it("should return 200 when user exists and has profile", async () => {
      const mockUser = {
        id: "user123",
        email: "test@test.com",
        user_metadata: { full_name: "Test User" }
      };

      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      // Mock profile lookup to return existing profile
      const profileQuery = {
        single: jest.fn().mockResolvedValue({
          data: { id: "user123" },
          error: null
        })
      };
      
      supabaseMock.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue(profileQuery)
        })
      });

      const res = await request(app)
        .post("/api/auth/login")
        .set("Authorization", "Bearer valid_token")
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Login successful");
      expect(res.body.user).toEqual({
        id: "user123",
        email: "test@test.com",
        full_name: "Test User"
      });
    });

    it("should handle database errors during profile check", async () => {
      const mockUser = {
        id: "user123",
        email: "test@test.com"
      };

      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      // Mock profile lookup to return database error
      const profileQuery = {
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'SOME_OTHER_ERROR', message: 'Database connection failed' }
        })
      };
      
      supabaseMock.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue(profileQuery)
        })
      });

      const res = await request(app)
        .post("/api/auth/login")
        .set("Authorization", "Bearer valid_token")
        .send({});

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Database error");
    });
  });

  describe("POST /api/auth/signup", () => {
    it("should return 400 when no authorization header is provided", async () => {
      const res = await request(app)
        .post("/api/auth/signup")
        .send({ degree: "Computer Science", interest: "AI" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Missing access token");
    });

    it("should return 401 when token is invalid", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Invalid token" }
      });

      const res = await request(app)
        .post("/api/auth/signup")
        .set("Authorization", "Bearer invalid_token")
        .send({ degree: "Computer Science", interest: "AI" });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid or expired token");
    });

    it("should return 400 when required fields are missing", async () => {
      const mockUser = {
        id: "user123",
        email: "test@test.com"
      };

      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const res = await request(app)
        .post("/api/auth/signup")
        .set("Authorization", "Bearer valid_token")
        .send({ degree: "Computer Science" }); // missing interest

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Degree and interest are required");
    });

    it("should create profile successfully with valid data", async () => {
      const mockUser = {
        id: "user123",
        email: "test@test.com",
        user_metadata: { full_name: "Test User" }
      };

      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      supabaseMock.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: null
        })
      });

      const res = await request(app)
        .post("/api/auth/signup")
        .set("Authorization", "Bearer valid_token")
        .send({
          degree: "Computer Science",
          modules: ["Math", "Physics"],
          interest: "AI"
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Signup successful");
      
      // Verify the insert was called with correct data
      expect(supabaseMock.from).toHaveBeenCalledWith("profiles");
      const insertCall = supabaseMock.from().insert;
      expect(insertCall).toHaveBeenCalledWith([
        expect.objectContaining({
          id: "user123",
          email: "test@test.com",
          full_name: "Test User",
          degree: "Computer Science",
          modules: ["Math", "Physics"],
          interest: "AI"
        })
      ]);
    });

    it("should handle empty modules array", async () => {
      const mockUser = {
        id: "user123",
        email: "test@test.com"
      };

      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      supabaseMock.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: null
        })
      });

      const res = await request(app)
        .post("/api/auth/signup")
        .set("Authorization", "Bearer valid_token")
        .send({
          degree: "Computer Science",
          modules: ["", "  ", "Valid Module"], // empty and whitespace strings
          interest: "AI"
        });

      expect(res.status).toBe(200);
      
      // Should filter out empty/whitespace modules
      const insertCall = supabaseMock.from().insert;
      expect(insertCall).toHaveBeenCalledWith([
        expect.objectContaining({
          modules: ["Valid Module"] // only non-empty module should remain
        })
      ]);
    });

    it("should return 500 when database insert fails", async () => {
      const mockUser = {
        id: "user123",
        email: "test@test.com"
      };

      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      supabaseMock.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: { message: "Database error" }
        })
      });

      const res = await request(app)
        .post("/api/auth/signup")
        .set("Authorization", "Bearer valid_token")
        .send({
          degree: "Computer Science",
          interest: "AI"
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to create user profile");
    });
  });
});