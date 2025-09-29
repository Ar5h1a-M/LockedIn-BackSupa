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
          single: jest.fn()
        })),
        in: jest.fn()
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn()
          }))
        }))
      }))
    }))
  };

  jest.unstable_mockModule("@supabase/supabase-js", () => ({
    createClient: () => supabaseMock,
  }));

  const mod = await import("../../src/server.js");
  app = mod.default || mod;
});

describe("Profile endpoints", () => {
  const mockUser = {
    id: "user123",
    email: "test@test.com",
    user_metadata: { full_name: "Test User" }
  };

  const mockProfile = {
    id: "user123",
    full_name: "Test User",
    email: "test@test.com",
    degree: "Computer Science",
    modules: ["Math", "Physics"],
    interest: "AI"
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/profile", () => {
    it("should return 401 when unauthorized", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      const res = await request(app)
        .get("/api/profile");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("should return user profile", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      supabaseMock.from.mockImplementation((table) => {
        if (table === "profiles") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: mockProfile,
                  error: null
                })
              }))
            }))
          };
        }
        return {};
      });

      const res = await request(app)
        .get("/api/profile")
        .set("Authorization", "Bearer valid_token");

      expect(res.status).toBe(200);
      expect(res.body.profile).toEqual(mockProfile);
    });
  });

  describe("PUT /api/profile", () => {
    it("should return 401 when unauthorized", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      const res = await request(app)
        .put("/api/profile")
        .send({ degree: "Updated Degree" });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("should update profile successfully", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const updatedProfile = {
        ...mockProfile,
        degree: "Updated Degree",
        interest: "Machine Learning"
      };

      supabaseMock.from.mockImplementation((table) => {
        if (table === "profiles") {
          return {
            update: jest.fn(() => ({
              eq: jest.fn(() => ({
                select: jest.fn(() => ({
                  single: jest.fn().mockResolvedValue({
                    data: updatedProfile,
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
        .put("/api/profile")
        .set("Authorization", "Bearer valid_token")
        .send({ 
          degree: "Updated Degree", 
          interest: "Machine Learning",
          modules: ["Advanced Math", "Statistics"]
        });

      expect(res.status).toBe(200);
      expect(res.body.profile).toEqual(updatedProfile);
    });

    it("should handle partial updates", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const partiallyUpdatedProfile = {
        ...mockProfile,
        degree: "Updated Degree Only"
      };

      supabaseMock.from.mockImplementation((table) => {
        if (table === "profiles") {
          return {
            update: jest.fn(() => ({
              eq: jest.fn(() => ({
                select: jest.fn(() => ({
                  single: jest.fn().mockResolvedValue({
                    data: partiallyUpdatedProfile,
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
        .put("/api/profile")
        .set("Authorization", "Bearer valid_token")
        .send({ degree: "Updated Degree Only" });

      expect(res.status).toBe(200);
      expect(res.body.profile.degree).toBe("Updated Degree Only");
    });
  });

  describe("GET /api/friends", () => {
    it("should return 401 when unauthorized", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      const res = await request(app)
        .get("/api/friends");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("should return empty friends list when user has no friends", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      supabaseMock.from.mockImplementation((table) => {
        if (table === "friendships") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({
                data: [],
                error: null
              })
            }))
          };
        }
        return {};
      });

      const res = await request(app)
        .get("/api/friends")
        .set("Authorization", "Bearer valid_token");

      expect(res.status).toBe(200);
      expect(res.body.friends).toEqual([]);
    });

    it("should return friends list with profiles", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const mockFriendships = [
        { friend_id: "friend123" },
        { friend_id: "friend456" }
      ];

      const mockFriendProfiles = [
        {
          id: "friend123",
          full_name: "John Friend",
          email: "john@test.com",
          degree: "Mathematics",
          modules: ["Calculus"],
          interest: "Teaching"
        },
        {
          id: "friend456",
          full_name: "Jane Friend",
          email: "jane@test.com",
          degree: "Physics",
          modules: ["Quantum"],
          interest: "Research"
        }
      ];

      supabaseMock.from.mockImplementation((table) => {
        if (table === "friendships") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({
                data: mockFriendships,
                error: null
              })
            }))
          };
        }
        if (table === "profiles") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: mockFriendProfiles,
                error: null
              })
            }))
          };
        }
        return {};
      });

      const res = await request(app)
        .get("/api/friends")
        .set("Authorization", "Bearer valid_token");

      expect(res.status).toBe(200);
      expect(res.body.friends).toEqual(mockFriendProfiles);
    });
  });
});