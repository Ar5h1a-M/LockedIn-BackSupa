import { jest } from "@jest/globals";
import request from "supertest";

// Mock the Supabase client BEFORE importing anything that uses it
const mockAuth = {
  getUser: jest.fn()
};

const mockFrom = jest.fn(() => ({
  insert: jest.fn(() => ({
    then: jest.fn((callback) => {
      if (typeof callback === 'function') {
        callback({ data: null, error: null });
      }
      return { catch: jest.fn() };
    })
  })),
  select: jest.fn(() => ({
    limit: jest.fn(() => ({
      contains: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      then: jest.fn((callback) => {
        if (typeof callback === 'function') {
          callback({ data: [], error: null });
        }
        return { catch: jest.fn() };
      })
    }))
  }))
}));

const mockSupabaseClient = {
  auth: mockAuth,
  from: mockFrom
};

jest.unstable_mockModule("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}));

let app;

beforeAll(async () => {
  // Now import the app after the mock is set up
  const mod = await import("../src/server.js");
  app = mod.default || mod;
});

describe("Search endpoints", () => {
  const mockUser = {
    id: "user123",
    email: "test@test.com",
    user_metadata: { full_name: "Test User" }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock implementations
    mockAuth.getUser.mockReset();
    mockFrom.mockReset();
    
    // Default mock implementations
    mockFrom.mockImplementation(() => ({
      insert: jest.fn(() => ({
        then: jest.fn((callback) => {
          if (typeof callback === 'function') {
            callback({ data: null, error: null });
          }
          return { catch: jest.fn() };
        })
      })),
      select: jest.fn(() => ({
        limit: jest.fn(() => ({
          contains: jest.fn().mockReturnThis(),
          ilike: jest.fn().mockReturnThis(),
          then: jest.fn((callback) => {
            if (typeof callback === 'function') {
              callback({ data: [], error: null });
            }
            return { catch: jest.fn() };
          })
        }))
      }))
    }));
  });

  describe("POST /api/search", () => {
    it("should return empty profiles when search term is empty", async () => {
      const res = await request(app)
        .post("/api/search")
        .send({ searchType: "full_name", searchTerm: "" });

      expect(res.status).toBe(200);
      expect(res.body.profiles).toEqual([]);
    });

    it("should return empty profiles when search term is whitespace only", async () => {
      const res = await request(app)
        .post("/api/search")
        .send({ searchType: "full_name", searchTerm: "   " });

      expect(res.status).toBe(200);
      expect(res.body.profiles).toEqual([]);
    });

    it("should return 400 for invalid search type", async () => {
      const res = await request(app)
        .post("/api/search")
        .send({ searchType: "invalid", searchTerm: "test" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid search type");
    });

    it("should search by full_name with ilike", async () => {
      const mockProfiles = [
        { id: "1", full_name: "John Doe", degree: "CS", modules: ["Math"], interest: "Programming" }
      ];

      // Create a chainable mock
      const mockThen = jest.fn((callback) => {
        callback({ data: mockProfiles, error: null });
        return { catch: jest.fn() };
      });

      const mockIlike = jest.fn().mockReturnValue({
        then: mockThen
      });

      const mockLimit = jest.fn().mockReturnValue({
        ilike: mockIlike,
        contains: jest.fn().mockReturnThis()
      });

      const mockSelect = jest.fn().mockReturnValue({
        limit: mockLimit
      });

      mockFrom.mockReturnValue({
        select: mockSelect
      });

      const res = await request(app)
        .post("/api/search")
        .send({ searchType: "full_name", searchTerm: "John" });

      expect(res.status).toBe(200);
      expect(res.body.profiles).toEqual(mockProfiles);
    });

    it("should search by name (alias for full_name)", async () => {
      const mockProfiles = [
        { id: "1", full_name: "Jane Smith", degree: "EE", modules: ["Physics"], interest: "Electronics" }
      ];

      const mockThen = jest.fn((callback) => {
        callback({ data: mockProfiles, error: null });
        return { catch: jest.fn() };
      });

      const mockIlike = jest.fn().mockReturnValue({
        then: mockThen
      });

      const mockLimit = jest.fn().mockReturnValue({
        ilike: mockIlike,
        contains: jest.fn().mockReturnThis()
      });

      const mockSelect = jest.fn().mockReturnValue({
        limit: mockLimit
      });

      mockFrom.mockReturnValue({
        select: mockSelect
      });

      const res = await request(app)
        .post("/api/search")
        .send({ searchType: "name", searchTerm: "Jane" });

      expect(res.status).toBe(200);
      expect(res.body.profiles).toEqual(mockProfiles);
    });

    it("should search by degree with ilike", async () => {
      const mockProfiles = [
        { id: "1", full_name: "Bob Wilson", degree: "Computer Science", modules: ["AI"], interest: "ML" }
      ];

      const mockThen = jest.fn((callback) => {
        callback({ data: mockProfiles, error: null });
        return { catch: jest.fn() };
      });

      const mockIlike = jest.fn().mockReturnValue({
        then: mockThen
      });

      const mockLimit = jest.fn().mockReturnValue({
        ilike: mockIlike,
        contains: jest.fn().mockReturnThis()
      });

      const mockSelect = jest.fn().mockReturnValue({
        limit: mockLimit
      });

      mockFrom.mockReturnValue({
        select: mockSelect
      });

      const res = await request(app)
        .post("/api/search")
        .send({ searchType: "degree", searchTerm: "Computer" });

      expect(res.status).toBe(200);
      expect(res.body.profiles).toEqual(mockProfiles);
    });

    it("should search by interest with ilike", async () => {
      const mockProfiles = [
        { id: "1", full_name: "Alice Johnson", degree: "Math", modules: ["Calculus"], interest: "Data Science" }
      ];

      const mockThen = jest.fn((callback) => {
        callback({ data: mockProfiles, error: null });
        return { catch: jest.fn() };
      });

      const mockIlike = jest.fn().mockReturnValue({
        then: mockThen
      });

      const mockLimit = jest.fn().mockReturnValue({
        ilike: mockIlike,
        contains: jest.fn().mockReturnThis()
      });

      const mockSelect = jest.fn().mockReturnValue({
        limit: mockLimit
      });

      mockFrom.mockReturnValue({
        select: mockSelect
      });

      const res = await request(app)
        .post("/api/search")
        .send({ searchType: "interest", searchTerm: "Data" });

      expect(res.status).toBe(200);
      expect(res.body.profiles).toEqual(mockProfiles);
    });

    it("should search by modules with contains", async () => {
      const mockProfiles = [
        { id: "1", full_name: "Charlie Brown", degree: "CS", modules: ["Mathematics", "Physics"], interest: "Theory" }
      ];

      const mockThen = jest.fn((callback) => {
        callback({ data: mockProfiles, error: null });
        return { catch: jest.fn() };
      });

      const mockContains = jest.fn().mockReturnValue({
        then: mockThen
      });

      const mockLimit = jest.fn().mockReturnValue({
        ilike: jest.fn().mockReturnThis(),
        contains: mockContains
      });

      const mockSelect = jest.fn().mockReturnValue({
        limit: mockLimit
      });

      mockFrom.mockReturnValue({
        select: mockSelect
      });

      const res = await request(app)
        .post("/api/search")
        .send({ searchType: "modules", searchTerm: "Mathematics" });

      expect(res.status).toBe(200);
      expect(res.body.profiles).toEqual(mockProfiles);
    });

    it("should handle multiple tokens for full_name search", async () => {
      const mockProfiles = [
        { id: "1", full_name: "John Doe Smith", degree: "CS", modules: ["Math"], interest: "Programming" }
      ];

      const mockThen = jest.fn((callback) => {
        callback({ data: mockProfiles, error: null });
        return { catch: jest.fn() };
      });

      // Create a chainable mock that returns itself
      const chainableMock = {
        ilike: jest.fn().mockReturnThis(),
        contains: jest.fn().mockReturnThis(),
        then: mockThen
      };

      const mockLimit = jest.fn().mockReturnValue(chainableMock);
      const mockSelect = jest.fn().mockReturnValue({ limit: mockLimit });

      mockFrom.mockReturnValue({ select: mockSelect });

      const res = await request(app)
        .post("/api/search")
        .send({ searchType: "full_name", searchTerm: "John Smith" });

      expect(res.status).toBe(200);
      expect(res.body.profiles).toEqual(mockProfiles);
    });

    it("should return empty array when no profiles found", async () => {
      const mockThen = jest.fn((callback) => {
        callback({ data: [], error: null });
        return { catch: jest.fn() };
      });

      const mockIlike = jest.fn().mockReturnValue({
        then: mockThen
      });

      const mockLimit = jest.fn().mockReturnValue({
        ilike: mockIlike,
        contains: jest.fn().mockReturnThis()
      });

      const mockSelect = jest.fn().mockReturnValue({
        limit: mockLimit
      });

      mockFrom.mockReturnValue({
        select: mockSelect
      });

      const res = await request(app)
        .post("/api/search")
        .send({ searchType: "full_name", searchTerm: "NonexistentUser" });

      expect(res.status).toBe(200);
      expect(res.body.profiles).toEqual([]);
    });

    it("should handle database errors", async () => {
      const mockThen = jest.fn((callback) => {
        callback({ data: null, error: new Error("DB Error") });
        return { catch: jest.fn() };
      });

      const mockIlike = jest.fn().mockReturnValue({
        then: mockThen
      });

      const mockLimit = jest.fn().mockReturnValue({
        ilike: mockIlike,
        contains: jest.fn().mockReturnThis()
      });

      const mockSelect = jest.fn().mockReturnValue({
        limit: mockLimit
      });

      mockFrom.mockReturnValue({
        select: mockSelect
      });

      const res = await request(app)
        .post("/api/search")
        .send({ searchType: "full_name", searchTerm: "Test" });

      expect(res.status).toBe(500);
    });

    it("should handle null data gracefully", async () => {
      const mockThen = jest.fn((callback) => {
        callback({ data: null, error: null });
        return { catch: jest.fn() };
      });

      const mockIlike = jest.fn().mockReturnValue({
        then: mockThen
      });

      const mockLimit = jest.fn().mockReturnValue({
        ilike: mockIlike,
        contains: jest.fn().mockReturnThis()
      });

      const mockSelect = jest.fn().mockReturnValue({
        limit: mockLimit
      });

      mockFrom.mockReturnValue({
        select: mockSelect
      });

      const res = await request(app)
        .post("/api/search")
        .send({ searchType: "full_name", searchTerm: "Test" });

      expect(res.status).toBe(200);
      expect(res.body.profiles).toEqual([]);
    });
  });

  describe("POST /api/invite", () => {
    it("should return 500 when auth.getUser returns an error", async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error("Invalid token")
      });

      const res = await request(app)
        .post("/api/invite")
        .set("Authorization", "Bearer invalid_token")
        .send({ recipient_id: "user456" });

      expect(res.status).toBe(500);
    });

    it("should return 401 when no user found but no auth error", async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      const res = await request(app)
        .post("/api/invite")
        .set("Authorization", "Bearer invalid_token")
        .send({ recipient_id: "user456" });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid token");
    });

    it("should send invitation successfully", async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const mockThen = jest.fn((callback) => {
        callback({ data: null, error: null });
        return { catch: jest.fn() };
      });

      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({ then: mockThen })
      });

      const res = await request(app)
        .post("/api/invite")
        .set("Authorization", "Bearer valid_token")
        .send({ recipient_id: "user456" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Invitation sent");
    });

    it("should handle database error when inserting invitation", async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const mockThen = jest.fn((callback) => {
        callback({ data: null, error: new Error("Insert failed") });
        return { catch: jest.fn() };
      });

      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({ then: mockThen })
      });

      const res = await request(app)
        .post("/api/invite")
        .set("Authorization", "Bearer valid_token")
        .send({ recipient_id: "user456" });

      expect(res.status).toBe(500);
    });

    it("should handle missing authorization header", async () => {
      const res = await request(app)
        .post("/api/invite")
        .send({ recipient_id: "user456" });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid token");
    });

    it("should handle malformed authorization header", async () => {
      const res = await request(app)
        .post("/api/invite")
        .set("Authorization", "InvalidFormat token123")
        .send({ recipient_id: "user456" });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid token");
    });

    it("should handle missing recipient_id", async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const mockThen = jest.fn((callback) => {
        callback({ data: null, error: null });
        return { catch: jest.fn() };
      });

      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({ then: mockThen })
      });

      const res = await request(app)
        .post("/api/invite")
        .set("Authorization", "Bearer valid_token")
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Invitation sent");
    });

    it("should handle empty request body", async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const mockThen = jest.fn((callback) => {
        callback({ data: null, error: null });
        return { catch: jest.fn() };
      });

      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({ then: mockThen })
      });

      const res = await request(app)
        .post("/api/invite")
        .set("Authorization", "Bearer valid_token");

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Invitation sent");
    });
  });
});