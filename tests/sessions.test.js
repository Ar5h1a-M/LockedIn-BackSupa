import { jest } from "@jest/globals";
import request from "supertest";

let app;
let supabaseMock;
let transporterMock;

beforeAll(async () => {
  // --- Mock Supabase client
  supabaseMock = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      eq: jest.fn(),
      in: jest.fn(),
      maybeSingle: jest.fn(),
      single: jest.fn(),
    })),
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

      supabaseMock.from.mockImplementation((table) => {
        if (table === "group_members") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn().mockResolvedValue({ data: null, error: null }),
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
              })),
              maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            })),
          };
        }
        return {};
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
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: { user_id: mockUser.id }, error: null }),
                maybeSingle: jest.fn().mockResolvedValue({ data: { user_id: mockUser.id }, error: null }),
              }),
              maybeSingle: jest.fn().mockResolvedValue({ data: { user_id: mockUser.id }, error: null }),
            }),
          };
        }
        return {};
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
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: { user_id: mockUser.id }, error: null }),
                maybeSingle: jest.fn().mockResolvedValue({ data: { user_id: mockUser.id }, error: null }),
              }),
              maybeSingle: jest.fn().mockResolvedValue({ data: { user_id: mockUser.id }, error: null }),
            }),
          };
        }
        return {};
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
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: { user_id: mockUser.id }, error: null }),
                maybeSingle: jest.fn().mockResolvedValue({ data: { user_id: mockUser.id }, error: null }),
              }),
              maybeSingle: jest.fn().mockResolvedValue({ data: { user_id: mockUser.id }, error: null }),
            }),
          };
        }
        return {};
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

      supabaseMock.from.mockImplementation((table) => {
        if (table === "group_members") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn().mockResolvedValue({
                  data: { user_id: mockUser.id },
                  error: null,
                }),
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { user_id: mockUser.id },
                  error: null,
                }),
              })),
              maybeSingle: jest.fn().mockResolvedValue({
                data: { user_id: mockUser.id },
                error: null,
              }),
            })),
          };
        }
        if (table === "sessions") {
          return {
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: mockSession,
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "group_members") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            })),
          };
        }
        return {};
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
  });
});
