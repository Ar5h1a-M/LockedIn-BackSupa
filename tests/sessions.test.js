import { jest } from "@jest/globals";
import request from "supertest";

let app;
let supabaseMock;
let transporterMock;

beforeAll(async () => {
  // Create a proper chainable mock structure with ALL Supabase methods
  const createChainableMock = (resultData = null, error = null) => {
    const mock = {
      // Query builder methods
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      
      // Filter methods
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      like: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      contains: jest.fn().mockReturnThis(),
      containedBy: jest.fn().mockReturnThis(),
      rangeGt: jest.fn().mockReturnThis(),
      rangeLt: jest.fn().mockReturnThis(),
      rangeGte: jest.fn().mockReturnThis(),
      rangeLte: jest.fn().mockReturnThis(),
      rangeAdjacent: jest.fn().mockReturnThis(),
      overlaps: jest.fn().mockReturnThis(),
      textSearch: jest.fn().mockReturnThis(),
      match: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      filter: jest.fn().mockReturnThis(),
      
      // Ordering and limiting
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      
      // Final execution methods
      maybeSingle: jest.fn().mockResolvedValue({ data: resultData, error }),
      single: jest.fn().mockResolvedValue({ data: resultData, error }),
      then: jest.fn((callback) => {
        if (typeof callback === 'function') {
          callback({ data: resultData, error });
        }
        return { catch: jest.fn() };
      })
    };
    return mock;
  };

  // --- Mock Supabase client
  supabaseMock = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(() => createChainableMock())
  };

  jest.unstable_mockModule("@supabase/supabase-js", () => ({
    createClient: () => supabaseMock,
  }));

  // --- Mock Nodemailer transporter
  transporterMock = {
    sendMail: jest.fn().mockResolvedValue({}),
    verify: jest.fn((cb) => cb(null, true)),
  };

  jest.unstable_mockModule("nodemailer", () => ({
    default: {
      createTransport: () => transporterMock,
    },
  }));

  const mod = await import("../src/server.js");
  app = mod.default || mod;
});

describe("Sessions endpoints", () => {
  const mockUser = {
    id: "user123",
    email: "test@test.com",
    user_metadata: { full_name: "Test User" },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/groups/:groupId/sessions", () => {
    const groupId = "1";

    it("should return 401 when unauthorized", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const res = await request(app)
        .post(`/api/groups/${groupId}/sessions`)
        .send({});

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("should return 403 when user is not a group member", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock group_members query to return null (not a member)
      supabaseMock.from.mockImplementation((table) => {
        if (table === "group_members") {
          const mock = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ 
              data: null, 
              error: null 
            })
          };
          return mock;
        }
        return createChainableMock();
      });

      const res = await request(app)
        .post(`/api/groups/${groupId}/sessions`)
        .set("Authorization", "Bearer valid_token")
        .send({ start_at: "2099-01-01T10:00:00Z" });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Not a group member");
    });

    it("should return 400 when start_at missing", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Simulate group member
      supabaseMock.from.mockImplementation((table) => {
        if (table === "group_members") {
          const mock = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ 
              data: { user_id: mockUser.id }, 
              error: null 
            })
          };
          return mock;
        }
        return createChainableMock();
      });

      const res = await request(app)
        .post(`/api/groups/${groupId}/sessions`)
        .set("Authorization", "Bearer valid_token")
        .send({}); // missing start_at

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("start_at is required");
    });

    it("should return 400 for invalid start_at date", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      supabaseMock.from.mockImplementation((table) => {
        if (table === "group_members") {
          const mock = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ 
              data: { user_id: mockUser.id }, 
              error: null 
            })
          };
          return mock;
        }
        return createChainableMock();
      });

      const res = await request(app)
        .post(`/api/groups/${groupId}/sessions`)
        .set("Authorization", "Bearer valid_token")
        .send({ start_at: "not-a-date" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid start_at");
    });

    it("should return 400 when start_at is in the past", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      supabaseMock.from.mockImplementation((table) => {
        if (table === "group_members") {
          const mock = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ 
              data: { user_id: mockUser.id }, 
              error: null 
            })
          };
          return mock;
        }
        return createChainableMock();
      });

      const res = await request(app)
        .post(`/api/groups/${groupId}/sessions`)
        .set("Authorization", "Bearer valid_token")
        .send({ start_at: "2000-01-01T00:00:00Z" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("start_at cannot be in the past");
    });

    it("should create session successfully", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockSession = {
        id: 99,
        group_id: groupId,
        creator_id: mockUser.id,
        start_at: "2099-01-01T10:00:00Z",
        venue: "Library",
        topic: "Algorithms",
        time_goal_minutes: 120,
        content_goal: "Finish chapter 3",
      };

      let callCount = 0;
      supabaseMock.from.mockImplementation((table) => {
        callCount++;
        
        if (table === "group_members") {
          if (callCount === 1) {
            // First call: check if user is group member
            const mock = {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              maybeSingle: jest.fn().mockResolvedValue({ 
                data: { user_id: mockUser.id }, 
                error: null 
              })
            };
            return mock;
          } else {
            // Subsequent calls: get member emails
            const mock = {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ 
                data: [
                  { user_id: "user1", profiles: { email: "user1@test.com" } },
                  { user_id: "user2", profiles: { email: "user2@test.com" } }
                ], 
                error: null 
              })
            };
            return mock;
          }
        }
        
        if (table === "sessions") {
          const mock = {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ 
              data: mockSession, 
              error: null 
            })
          };
          return mock;
        }
        
        return createChainableMock();
      });

      const res = await request(app)
        .post(`/api/groups/${groupId}/sessions`)
        .set("Authorization", "Bearer valid_token")
        .send({
          start_at: mockSession.start_at,
          venue: mockSession.venue,
          topic: mockSession.topic,
          time_goal_minutes: mockSession.time_goal_minutes,
          content_goal: mockSession.content_goal,
        });

      expect(res.status).toBe(200);
      expect(res.body.session).toEqual(mockSession);
    });

    it("should handle database errors when creating session", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      supabaseMock.from.mockImplementation((table) => {
        if (table === "group_members") {
          const mock = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ 
              data: { user_id: mockUser.id }, 
              error: null 
            })
          };
          return mock;
        }
        if (table === "sessions") {
          const mock = {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ 
              data: null, 
              error: new Error("Database error") 
            })
          };
          return mock;
        }
        return createChainableMock();
      });

      const res = await request(app)
        .post(`/api/groups/${groupId}/sessions`)
        .set("Authorization", "Bearer valid_token")
        .send({
          start_at: "2099-01-01T10:00:00Z",
        });

      expect(res.status).toBe(500);
    });
  });

  describe("GET /api/groups/:groupId/sessions", () => {
    const groupId = "1";

    it("should return 401 when unauthorized", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const res = await request(app)
        .get(`/api/groups/${groupId}/sessions`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("should return sessions for group", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockSessions = [
        {
          id: 1,
          group_id: groupId,
          creator_id: mockUser.id,
          start_at: "2099-01-01T10:00:00Z",
          venue: "Library",
          topic: "Algorithms"
        }
      ];

      let callCount = 0;
      supabaseMock.from.mockImplementation((table) => {
        callCount++;
        
        if (table === "group_members") {
          const mock = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ 
              data: { user_id: mockUser.id }, 
              error: null 
            })
          };
          return mock;
        }
        
        if (table === "sessions") {
          const mock = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ 
              data: mockSessions, 
              error: null 
            })
          };
          return mock;
        }
        
        return createChainableMock();
      });

      const res = await request(app)
        .get(`/api/groups/${groupId}/sessions`)
        .set("Authorization", "Bearer valid_token");

      expect(res.status).toBe(200);
      expect(res.body.sessions).toEqual(mockSessions);
    });

    it("should handle database errors when fetching sessions", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      supabaseMock.from.mockImplementation((table) => {
        if (table === "group_members") {
          const mock = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ 
              data: { user_id: mockUser.id }, 
              error: null 
            })
          };
          return mock;
        }
        
        if (table === "sessions") {
          const mock = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ 
              data: null, 
              error: new Error("Database error") 
            })
          };
          return mock;
        }
        
        return createChainableMock();
      });

      const res = await request(app)
        .get(`/api/groups/${groupId}/sessions`)
        .set("Authorization", "Bearer valid_token");

      expect(res.status).toBe(500);
    });
  });
});