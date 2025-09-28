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
        in: jest.fn()
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

describe("Invitations endpoints", () => {
  const mockUser = {
    id: "user123",
    email: "test@test.com",
    user_metadata: { full_name: "Test User" }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/invitations/received", () => {
    it("should return 401 when unauthorized", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      const res = await request(app)
        .get("/api/invitations/received");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("should return empty invitations when user has none", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      supabaseMock.from.mockImplementation((table) => {
        if (table === "invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null
                })
              }))
            }))
          };
        }
        return {};
      });

      const res = await request(app)
        .get("/api/invitations/received")
        .set("Authorization", "Bearer valid_token");

      expect(res.status).toBe(200);
      expect(res.body.invitations).toEqual([]);
    });

    it("should return received invitations with sender names", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const mockInvitations = [
        {
          id: 1,
          sender_id: "sender123",
          recipient_id: "user123",
          status: "pending",
          sent_at: "2025-01-01T00:00:00Z"
        }
      ];

      const mockProfiles = [
        {
          id: "sender123",
          full_name: "John Sender"
        }
      ];

      supabaseMock.from.mockImplementation((table) => {
        if (table === "invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: mockInvitations,
                  error: null
                })
              }))
            }))
          };
        }
        if (table === "profiles") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: mockProfiles,
                error: null
              })
            }))
          };
        }
        return {};
      });

      const res = await request(app)
        .get("/api/invitations/received")
        .set("Authorization", "Bearer valid_token");

      expect(res.status).toBe(200);
      expect(res.body.invitations[0]).toMatchObject({
        id: 1,
        sender_id: "sender123",
        recipient_id: "user123",
        status: "pending",
        sender_name: "John Sender"
      });
    });
  });

  describe("GET /api/invitations/sent", () => {
    it("should return 401 when unauthorized", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      const res = await request(app)
        .get("/api/invitations/sent");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("should return empty invitations when user has sent none", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      supabaseMock.from.mockImplementation((table) => {
        if (table === "invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null
                })
              }))
            }))
          };
        }
        return {};
      });

      const res = await request(app)
        .get("/api/invitations/sent")
        .set("Authorization", "Bearer valid_token");

      expect(res.status).toBe(200);
      expect(res.body.invitations).toEqual([]);
    });

    it("should return sent invitations with recipient names", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const mockInvitations = [
        {
          id: 1,
          sender_id: "user123",
          recipient_id: "recipient456",
          status: "pending",
          sent_at: "2025-01-01T00:00:00Z"
        }
      ];

      const mockProfiles = [
        {
          id: "recipient456",
          full_name: "Jane Recipient"
        }
      ];

      supabaseMock.from.mockImplementation((table) => {
        if (table === "invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: mockInvitations,
                  error: null
                })
              }))
            }))
          };
        }
        if (table === "profiles") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: mockProfiles,
                error: null
              })
            }))
          };
        }
        return {};
      });

      const res = await request(app)
        .get("/api/invitations/sent")
        .set("Authorization", "Bearer valid_token");

      expect(res.status).toBe(200);
      expect(res.body.invitations[0]).toMatchObject({
        id: 1,
        sender_id: "user123",
        recipient_id: "recipient456",
        status: "pending",
        recipient_name: "Jane Recipient"
      });
    });
  });

  describe("PUT /api/invitations/:id", () => {
    it("should return 401 when unauthorized", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      const res = await request(app)
        .put("/api/invitations/1")
        .send({ status: "accepted" });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("should return 400 for invalid status", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const res = await request(app)
        .put("/api/invitations/1")
        .set("Authorization", "Bearer valid_token")
        .send({ status: "invalid" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid status");
    });

    it("should return 404 when invitation not found", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      supabaseMock.from.mockImplementation((table) => {
        if (table === "invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: null
                })
              }))
            }))
          };
        }
        return {};
      });

      const res = await request(app)
        .put("/api/invitations/999")
        .set("Authorization", "Bearer valid_token")
        .send({ status: "accepted" });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Invitation not found");
    });

    it("should return 403 when not the recipient", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      supabaseMock.from.mockImplementation((table) => {
        if (table === "invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: {
                    sender_id: "sender123",
                    recipient_id: "other_user",
                    status: "pending"
                  },
                  error: null
                })
              }))
            }))
          };
        }
        return {};
      });

      const res = await request(app)
        .put("/api/invitations/1")
        .set("Authorization", "Bearer valid_token")
        .send({ status: "accepted" });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Not authorized");
    });

    it("should return 400 when invitation already handled", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      supabaseMock.from.mockImplementation((table) => {
        if (table === "invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: {
                    sender_id: "sender123",
                    recipient_id: "user123",
                    status: "accepted"
                  },
                  error: null
                })
              }))
            }))
          };
        }
        return {};
      });

      const res = await request(app)
        .put("/api/invitations/1")
        .set("Authorization", "Bearer valid_token")
        .send({ status: "accepted" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invitation already handled");
    });

    it("should accept invitation and create friendships", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      supabaseMock.from.mockImplementation((table) => {
        if (table === "invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: {
                    sender_id: "sender123",
                    recipient_id: "user123",
                    status: "pending"
                  },
                  error: null
                })
              }))
            })),
            update: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({
                data: null,
                error: null
              })
            }))
          };
        }
        if (table === "friendships") {
          return {
            upsert: jest.fn().mockResolvedValue({
              data: null,
              error: null
            })
          };
        }
        return {};
      });

      const res = await request(app)
        .put("/api/invitations/1")
        .set("Authorization", "Bearer valid_token")
        .send({ status: "accepted" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Invitation accepted");
    });

    it("should decline invitation without creating friendships", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      supabaseMock.from.mockImplementation((table) => {
        if (table === "invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: {
                    sender_id: "sender123",
                    recipient_id: "user123",
                    status: "pending"
                  },
                  error: null
                })
              }))
            })),
            update: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({
                data: null,
                error: null
              })
            }))
          };
        }
        return {};
      });

      const res = await request(app)
        .put("/api/invitations/1")
        .set("Authorization", "Bearer valid_token")
        .send({ status: "declined" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Invitation declined");
    });
  });
});