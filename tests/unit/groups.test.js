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
          single: jest.fn()
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

describe("Groups endpoints", () => {
  const mockUser = {
    id: "user123",
    email: "test@test.com",
    user_metadata: { full_name: "Test User" }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/groups", () => {
    it("should return 401 when no authorization header", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "No token" }
      });

      const res = await request(app)
        .post("/api/groups")
        .send({ name: "Test Group" });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("should return 400 when name is missing", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const res = await request(app)
        .post("/api/groups")
        .set("Authorization", "Bearer valid_token")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Group name required");
    });

    it("should create group successfully", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const mockGroup = {
        id: 1,
        owner_id: "user123",
        name: "Test Group",
        module: "Computer Science",
        created_at: "2025-01-01T00:00:00Z"
      };

      const insertQuery = {
        select: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: mockGroup,
            error: null
          })
        }))
      };

      supabaseMock.from.mockImplementation((table) => {
        if (table === "groups") {
          return {
            insert: jest.fn(() => insertQuery)
          };
        }
        if (table === "group_members") {
          return {
            insert: jest.fn().mockResolvedValue({ data: null, error: null })
          };
        }
        return {};
      });

      const res = await request(app)
        .post("/api/groups")
        .set("Authorization", "Bearer valid_token")
        .send({ name: "Test Group", module: "Computer Science" });

      expect(res.status).toBe(200);
      expect(res.body.group).toEqual(mockGroup);
    });
  });

  describe("GET /api/groups", () => {
    it("should return 401 when unauthorized", async () => {
      // Mock getUser to return null (no token case)
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      const res = await request(app)
        .get("/api/groups");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("should return empty groups when user has none", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      supabaseMock.from.mockImplementation((table) => {
        if (table === "groups") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({
                data: [],
                error: null
              })
            }))
          };
        }
        if (table === "group_members") {
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
        .get("/api/groups")
        .set("Authorization", "Bearer valid_token");

      expect(res.status).toBe(200);
      expect(res.body.groups).toEqual([]);
    });

    it("should return user's groups", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const ownedGroups = [{ id: 1, owner_id: "user123", name: "Owned Group" }];
      const memberGroups = [{ group_id: 2 }];
      const allGroups = [
        { id: 1, owner_id: "user123", name: "Owned Group" },
        { id: 2, owner_id: "other", name: "Member Group" }
      ];

      supabaseMock.from.mockImplementation((table) => {
        if (table === "groups") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({
                data: ownedGroups,
                error: null
              }),
              in: jest.fn().mockResolvedValue({
                data: allGroups,
                error: null
              })
            }))
          };
        }
        if (table === "group_members") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({
                data: memberGroups,
                error: null
              })
            }))
          };
        }
        return {};
      });

      const res = await request(app)
        .get("/api/groups")
        .set("Authorization", "Bearer valid_token");

      expect(res.status).toBe(200);
      expect(res.body.groups).toEqual(allGroups);
    });
  });

  describe("POST /api/group-invitations", () => {
    it("should return 401 when unauthorized", async () => {
      // Mock getUser to return null (no token case)
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      const res = await request(app)
        .post("/api/group-invitations")
        .send({ group_id: 1, recipient_ids: ["user456"] });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("should return 400 when required fields missing", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const res = await request(app)
        .post("/api/group-invitations")
        .set("Authorization", "Bearer valid_token")
        .send({ group_id: 1 }); // missing recipient_ids

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("group_id and recipient_ids[] required");
    });

    it("should return 403 when user is not group owner", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      supabaseMock.from.mockImplementation((table) => {
        if (table === "groups") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: { owner_id: "other_user" },
                  error: null
                })
              }))
            }))
          };
        }
        return {};
      });

      const res = await request(app)
        .post("/api/group-invitations")
        .set("Authorization", "Bearer valid_token")
        .send({ group_id: 1, recipient_ids: ["user456"] });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Only owner can invite");
    });

    it("should send invitations successfully", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      supabaseMock.from.mockImplementation((table) => {
        if (table === "groups") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: { owner_id: "user123" },
                  error: null
                })
              }))
            }))
          };
        }
        if (table === "group_invitations") {
          return {
            insert: jest.fn().mockResolvedValue({
              data: null,
              error: null
            })
          };
        }
        return {};
      });

      const res = await request(app)
        .post("/api/group-invitations")
        .set("Authorization", "Bearer valid_token")
        .send({ group_id: 1, recipient_ids: ["user456", "user789"] });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Invitations sent");
    });
  });

  describe("GET /api/group-invitations/received", () => {
    it("should return 401 when unauthorized", async () => {
      // Mock getUser to return null (no token case)
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      const res = await request(app)
        .get("/api/group-invitations/received");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("should return received invitations with group details", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const mockInvitations = [
        {
          id: 1,
          group_id: 1,
          sender_id: "sender123",
          recipient_id: "user123",
          status: "pending",
          sent_at: "2025-01-01T00:00:00Z"
        }
      ];

      const mockGroups = [
        {
          id: 1,
          name: "Study Group",
          module: "Math",
          owner_id: "sender123"
        }
      ];

      supabaseMock.from.mockImplementation((table) => {
        if (table === "group_invitations") {
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
        if (table === "groups") {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: mockGroups,
                error: null
              })
            }))
          };
        }
        return {};
      });

      const res = await request(app)
        .get("/api/group-invitations/received")
        .set("Authorization", "Bearer valid_token");

      expect(res.status).toBe(200);
      expect(res.body.invitations[0]).toMatchObject({
        id: 1,
        group_name: "Study Group",
        group_module: "Math",
        group_owner_id: "sender123"
      });
    });
  });

  describe("PUT /api/group-invitations/:id", () => {
    it("should return 401 when unauthorized", async () => {
      // Mock getUser to return null (no token case)
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      const res = await request(app)
        .put("/api/group-invitations/1")
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
        .put("/api/group-invitations/1")
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
        if (table === "group_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: null  // Changed: return null data with no error instead of PGRST116 error
                })
              }))
            }))
          };
        }
        return {};
      });

      const res = await request(app)
        .put("/api/group-invitations/999")
        .set("Authorization", "Bearer valid_token")
        .send({ status: "accepted" });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Invite not found");
    });

    it("should return 403 when not the recipient", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      supabaseMock.from.mockImplementation((table) => {
        if (table === "group_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: {
                    group_id: 1,
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
        .put("/api/group-invitations/1")
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
        if (table === "group_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: {
                    group_id: 1,
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
        .put("/api/group-invitations/1")
        .set("Authorization", "Bearer valid_token")
        .send({ status: "accepted" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Already handled");
    });

    it("should accept invitation and add to group", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      supabaseMock.from.mockImplementation((table) => {
        if (table === "group_invitations") {
          const selectMock = {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: {
                    group_id: 1,
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
          return selectMock;
        }
        if (table === "group_members") {
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
        .put("/api/group-invitations/1")
        .set("Authorization", "Bearer valid_token")
        .send({ status: "accepted" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Group invite accepted");
    });

    it("should decline invitation without adding to group", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      supabaseMock.from.mockImplementation((table) => {
        if (table === "group_invitations") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: {
                    group_id: 1,
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
        .put("/api/group-invitations/1")
        .set("Authorization", "Bearer valid_token")
        .send({ status: "declined" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Group invite declined");
    });
  });
});