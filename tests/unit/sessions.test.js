
/// tests\unit\sessions.test.js
import { jest } from "@jest/globals";
import request from "supertest";

let app;
let supabaseMock;

const debugTableCalls = () => {
  console.log('Table calls in order:');
  supabaseMock.from.mock.calls.forEach((call, i) => {
    console.log(`  ${i + 1}: "${call[0]}"`);
  });
};

// ---- Remove nodemailer mocks and add EmailJS mocks ----
global.fetch = jest.fn();

// ---- Chainable Supabase QB with .maybeSingle() & .single() & .upsert() ----
const makeQB = (handlers = {}) => {
  const resolve = (key, fallback = { data: [], error: null }) =>
    Promise.resolve(handlers[key] ? handlers[key]() : fallback);

  const qb = {
    // chainables
    select: jest.fn(() => qb),
    insert: jest.fn(() => qb),
    update: jest.fn(() => qb),
    delete: jest.fn(() => qb),
    upsert: jest.fn(() => qb),
    eq: jest.fn(() => qb),
    neq: jest.fn(() => qb), // ADDED: neq method
    in: jest.fn(() => qb),
    order: jest.fn(() => qb),
    limit: jest.fn(() => qb),

    // terminals
    single: jest.fn(() => ({
      then: (onFulfilled, onRejected) =>
        resolve("single", { data: null, error: null }).then(onFulfilled, onRejected),
    })),
    maybeSingle: jest.fn(() => ({
      then: (onFulfilled, onRejected) =>
        resolve("maybeSingle", { data: null, error: null }).then(onFulfilled, onRejected),
    })),
  };

  const thenable = {
    then: (onFulfilled, onRejected) =>
      resolve("await", { data: [], error: null }).then(onFulfilled, onRejected),
    catch: () => thenable,
    finally: () => thenable,
  };

  return new Proxy(qb, {
    get(target, prop) {
      if (prop === "then") return thenable.then;
      return target[prop];
    },
  });
};

beforeAll(async () => {
  const user = { id: "user-123", email: "creator@test.com" };

  // === Base builders used across tests (overridden per-test as needed) ===

  // membership gate: .maybeSingle() must return a row (truthy)
  const groupMembersQB_allow = makeQB({
    maybeSingle: () => ({ data: { user_id: "user-123" }, error: null }),
    // when awaited after insert, you select("profiles(...)") → return list with profiles (emails)
    await: () => ({
      data: [
        { 
          profiles: { 
            id: "user-123", 
            email: "creator@test.com", 
            full_name: "Creator" 
          } 
        },
        { 
          profiles: { 
            id: "user-456", 
            email: "mate@test.com", 
            full_name: "Mate One" 
          } 
        },
      ],
      error: null,
    }),
  });

  const groupMembersQB_none = makeQB({
    maybeSingle: () => ({ data: { user_id: "user-123" }, error: null }),
    await: () => ({ data: [], error: null }),
  });

  const groupMembersQB_deny = makeQB({
    maybeSingle: () => ({ data: null, error: null }),
  });

  // list sessions (GET) → awaiting returns rows sorted by start_at
  const listSessionsQB = makeQB({
    await: () => ({
      data: [
        { id: 10, group_id: 1, creator_id: "user-123", topic: "T1", start_at: "2099-12-25T10:00:00Z" },
        { id: 11, group_id: 1, creator_id: "user-456", topic: "T2", start_at: "2099-12-26T10:00:00Z" },
      ],
      error: null,
    }),
  });

  // insert session (POST) → .single() must return the just-created row
  const insertSessionQB = makeQB({
    single: () => ({
      data: {
        id: 777,
        group_id: 1,
        creator_id: "user-123",
        start_at: "2099-12-25T10:00:00Z",
        venue: "Library",
        topic: "Future Study",
        time_goal_minutes: 90,
        content_goal: "Ch 1–3",
      },
      error: null,
    }),
    await: () => ({ data: [{ id: 777 }], error: null }),
  });

  // fetch session (DELETE) – not mine
  const fetchOtherCreatorQB = makeQB({
    single: () => ({
      data: { id: 11, group_id: 1, creator_id: "someone-else", start_at: "2099-12-26T10:00:00Z" },
      error: null,
    }),
  });

  // fetch session (DELETE) – mine
  const fetchOwnQB = makeQB({
    single: () => ({
      data: { id: 10, group_id: 1, creator_id: "user-123", start_at: "2099-12-25T10:00:00Z" },
      error: null,
    }),
  });

  // fetch session (DELETE) – not found (404 branch)
  const fetchNotFoundQB = makeQB({
    single: () => ({ data: null, error: null }),
  });

  // delete builder (DELETE) – chain: .delete().eq().eq() then await
  const deleteQB = makeQB({
    await: () => ({ data: [{ id: 10 }], error: null }),
  });

  // session_invites:
  const invitesQB_empty = makeQB({ await: () => ({ data: [], error: null }) });
  const invitesQB_upsertOK = makeQB({ await: () => ({ data: [{ ok: true }], error: null }) });
  const invitesQB_acceptedOne = makeQB({
    await: () => ({ data: [{ session_id: 999 }], error: null }),
  });

  // sessions lookup by IDs for conflict check:
  const sessionsConflictNoneQB = makeQB({
    await: () => ({ data: [{ id: 999, start_at: "2099-12-24T10:00:00Z", topic: "Other" }], error: null }),
  });
  const sessionsConflictYesQB = makeQB({
    await: () => ({ data: [{ id: 999, start_at: "2099-12-25T10:00:00Z", topic: "Clash" }], error: null }),
  });

  // profiles lookup (creator)
  const profilesQB_creator = makeQB({
    single: () => ({ data: { email: "creator@test.com", full_name: "Creator" }, error: null }),
  });

  // profiles lookup (user who accepted)
  const profilesQB_memberA = makeQB({
    single: () => ({ data: { full_name: "Mate One", email: "mate@test.com" }, error: null }),
  });

  // group_messages list / post
  const groupMessagesQB_list = makeQB({
    await: () => ({
      data: [
        { id: 1, group_id: "1", session_id: 10, sender_id: "user-123", content: "hi", attachment_url: null, created_at: "2025-01-01T00:00:00Z" },
        { id: 2, group_id: "1", session_id: 11, sender_id: "user-456", content: "yo", attachment_url: null, created_at: "2025-01-01T00:01:00Z" },
      ],
      error: null,
    }),
  });
  const groupMessagesQB_listForSession = makeQB({
    await: () => ({
      data: [
        { id: 2, group_id: "1", session_id: "11", sender_id: "user-456", content: "yo", attachment_url: null, created_at: "2025-01-01T00:01:00Z" },
      ],
      error: null,
    }),
  });
  const groupMessagesQB_insertSingle = makeQB({
    single: () => ({
      data: { id: 3, group_id: "1", session_id: 10, sender_id: "user-123", content: "posted", attachment_url: null },
      error: null,
    }),
  });

  // profiles for name enrichment
  const profilesQB_enrich = makeQB({
    await: () => ({ data: [{ id: "user-123", full_name: "Creator" }, { id: "user-456", full_name: "Mate One" }], error: null }),
  });

  // default mapping
  supabaseMock = {
    _user: user,
    auth: {
      // Accepts a token argument and returns user if token is truthy
      getUser: jest.fn(async (token) => {
        if (!token) return { data: { user: null }, error: null };
        return { data: { user: supabaseMock._user }, error: null };
      }),
    },
    from: jest.fn((table) => {
      switch (table) {
        case "group_members":
          return groupMembersQB_allow;
        case "sessions":
          return listSessionsQB;
        case "session_invites":
          return invitesQB_empty;
        case "profiles":
          return profilesQB_creator;
        case "group_messages":
          return groupMessagesQB_list;
        default:
          return makeQB();
      }
    }),
    // helper to override table→QB mapping inside a test
    _setFrom: (mapping) => {
      supabaseMock.from = jest.fn((table) => mapping[table] || makeQB());
    },
    __builders: {
      // membership
      groupMembersQB_allow,
      groupMembersQB_none,
      groupMembersQB_deny,
      // sessions
      listSessionsQB,
      insertSessionQB,
      fetchOtherCreatorQB,
      fetchOwnQB,
      fetchNotFoundQB,
      deleteQB,
      // invites
      invitesQB_empty,
      invitesQB_upsertOK,
      invitesQB_acceptedOne,
      sessionsConflictNoneQB,
      sessionsConflictYesQB,
      // profiles
      profilesQB_creator,
      profilesQB_memberA,
      profilesQB_enrich,
      // messages
      groupMessagesQB_list,
      groupMessagesQB_listForSession,
      groupMessagesQB_insertSingle,
    },
  };

  jest.unstable_mockModule("@supabase/supabase-js", () => ({
    createClient: () => supabaseMock,
  }));

  // Mock fetch for EmailJS
  global.fetch.mockImplementation(() => 
    Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve('OK'),
      json: () => Promise.resolve({ status: 'success', message: 'Email sent successfully' })
    })
  );

  // Set test environment
  process.env.NODE_ENV = 'test';
  
  const mod = await import("../../src/server.js");
  app = mod.default || mod;
});

beforeEach(() => {
  global.fetch.mockClear();
});

describe("Sessions routes", () => {
  const token = "valid.token";

  //
  // CREATE  POST /api/groups/:groupId/sessions
  //
  describe("POST /api/groups/:groupId/sessions", () => {
    test("400 when start_at is missing or in the past", async () => {
      const { groupMembersQB_allow, insertSessionQB } = supabaseMock.__builders;
      supabaseMock._setFrom({
        group_members: groupMembersQB_allow,
        sessions: insertSessionQB,
      });

      // missing start_at → 400
      const r1 = await request(app)
        .post("/api/groups/1/sessions")
        .set("Authorization", `Bearer ${token}`)
        .send({ topic: "X" });
      expect(r1.status).toBe(400);

      // past date → 400
      const r2 = await request(app)
        .post("/api/groups/1/sessions")
        .set("Authorization", `Bearer ${token}`)
        .send({ start_at: "2000-01-01T10:00:00Z" });
      expect(r2.status).toBe(400);
    });

    test("401 when no/invalid token", async () => {
      supabaseMock.auth.getUser.mockImplementationOnce(async (token) => {
        return { data: { user: null }, error: null };
      });

      const res = await request(app)
        .post("/api/groups/1/sessions")
        .send({ start_at: "2099-12-25T10:00:00Z" });

      expect(res.status).toBe(401);
    });

    test("403 when requester is not a group member", async () => {
      const { groupMembersQB_deny, insertSessionQB } = supabaseMock.__builders;

      supabaseMock.auth.getUser.mockReset();
      supabaseMock.auth.getUser.mockImplementation(async (token) => {
        if (!token) return { data: { user: null }, error: null };
        return { data: { user: { id: 'user-123', email: 'creator@test.com' } }, error: null };
      });

      supabaseMock._setFrom({
        group_members: groupMembersQB_deny,
        sessions: insertSessionQB,
      });

      const res = await request(app)
        .post("/api/groups/1/sessions")
        .set("Authorization", `Bearer ${token}`)
        .send({ 
          start_at: "2099-12-25T10:00:00Z",
          venue: "Test Venue",
          topic: "Test Topic"
        });
    
      debugTableCalls();
      expect(res.status).toBe(403);
    });

    test("200 and early return when there are no members (no emails/invites)", async () => {
      const { groupMembersQB_none, insertSessionQB } = supabaseMock.__builders;

      const noMembersQB = {
        ...groupMembersQB_none,
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(), // ADDED: neq method
        await: jest.fn(() => Promise.resolve({
          data: [], // No members
          error: null
        }))
      };

      supabaseMock._setFrom({
        group_members: noMembersQB,
        sessions: insertSessionQB,
      });

      const body = {
        start_at: "2099-12-25T10:00:00Z",
        venue: "Library",
        topic: "Future Study",
        time_goal_minutes: 90,
        content_goal: "Chapter 1-3"
      };

      const res = await request(app)
        .post("/api/groups/1/sessions")
        .set("Authorization", `Bearer ${token}`)
        .send(body);

      expect(res.status).toBe(200);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test("200; invites are sent to members without conflicts", async () => {
      const { groupMembersQB_allow, insertSessionQB, invitesQB_upsertOK } = supabaseMock.__builders;

      const memberLookupQB = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(), // ADDED: neq method
        await: jest.fn(() => Promise.resolve({
          data: [
            { 
              profiles: { 
                id: "user-123", 
                email: "creator@test.com", 
                full_name: "Creator" 
              } 
            },
            { 
              profiles: { 
                id: "user-456", 
                email: "mate@test.com", 
                full_name: "Mate One" 
              } 
            },
          ],
          error: null
        }))
      };

      const sessionInvitesSelectQB = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        await: jest.fn(() => Promise.resolve({
          data: [], // No conflicts
          error: null
        }))
      };

      const sessionsSelectQB = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        await: jest.fn(() => Promise.resolve({
          data: [], // No conflicting sessions
          error: null
        }))
      };

      let callCount = 0;
      supabaseMock.from = jest.fn((table) => {
        callCount++;
        
        switch (table) {
          case "group_members":
            return callCount === 1 ? groupMembersQB_allow : memberLookupQB;
          case "sessions":
            return callCount === 2 ? insertSessionQB : sessionsSelectQB;
          case "session_invites":
            return callCount === 5 ? sessionInvitesSelectQB : invitesQB_upsertOK;
          case "profiles":
            return supabaseMock.__builders.profilesQB_creator;
          default:
            return makeQB();
        }
      });

      const res = await request(app)
        .post("/api/groups/1/sessions")
        .set("Authorization", `Bearer ${token}`)
        .send({ 
          start_at: "2099-12-25T10:00:00Z",
          venue: "Library",
          topic: "Future Study",
          time_goal_minutes: 90,
          content_goal: "Chapter 1-3"
        });
    
      debugTableCalls();
      expect(res.status).toBe(200);
      expect(res.body.session).toBeDefined();
    });
  });

  //
  // LIST  GET /api/groups/:groupId/sessions
  //
  describe("GET /api/groups/:groupId/sessions", () => {
    test("chains .select().eq('group_id','1').order('start_at') and returns 200", async () => {
      const { groupMembersQB_allow, listSessionsQB } = supabaseMock.__builders;
      supabaseMock._setFrom({
        group_members: groupMembersQB_allow,
        sessions: listSessionsQB,
      });

      const res = await request(app)
        .get("/api/groups/1/sessions")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(supabaseMock.from).toHaveBeenCalledWith("sessions");

      const qb = supabaseMock.from.mock.results.find(r => r.value === listSessionsQB).value;
      expect(qb.select).toHaveBeenCalled();
      expect(qb.eq).toHaveBeenCalledWith("group_id", "1");
      expect(qb.order).toHaveBeenCalledWith("start_at", expect.any(Object));
    });
  });

  //
  // DELETE  DELETE /api/groups/:groupId/sessions/:sessionId
  //
  describe("DELETE /api/groups/:groupId/sessions/:sessionId", () => {
    test("403 if requester is not the session creator", async () => {
      const { groupMembersQB_allow, fetchOtherCreatorQB, deleteQB } = supabaseMock.__builders;

      let call = 0;
      supabaseMock.from = jest.fn((table) => {
        if (table === "group_members") return groupMembersQB_allow;
        if (table === "sessions") return call++ === 0 ? fetchOtherCreatorQB : deleteQB;
        return makeQB();
      });

      const res = await request(app)
        .delete("/api/groups/1/sessions/11")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    test("404 when session not found", async () => {
      const { groupMembersQB_allow, fetchNotFoundQB, deleteQB } = supabaseMock.__builders;

      let call = 0;
      supabaseMock.from = jest.fn((table) => {
        if (table === "group_members") return groupMembersQB_allow;
        if (table === "sessions") return call++ === 0 ? fetchNotFoundQB : deleteQB;
        return makeQB();
      });

      const res = await request(app)
        .delete("/api/groups/1/sessions/9999")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    test("200 when requester is the creator (performs delete with filters)", async () => {
      const { groupMembersQB_allow, fetchOwnQB, deleteQB } = supabaseMock.__builders;

      let call = 0;
      supabaseMock.from = jest.fn((table) => {
        if (table === "group_members") return groupMembersQB_allow;
        if (table === "sessions") return call++ === 0 ? fetchOwnQB : deleteQB;
        return makeQB();
      });

      const res = await request(app)
        .delete("/api/groups/1/sessions/10")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(deleteQB.delete).toHaveBeenCalled();
      expect(deleteQB.eq).toHaveBeenCalledWith("id", "10");
    });
  });

  //
  // RSVP EMAIL LINKS (GET)
  //
  describe("GET /api/sessions/:sessionId/(accept|decline)/:userId", () => {
    test("accept returns 200", async () => {
      const { invitesQB_upsertOK } = supabaseMock.__builders;
      supabaseMock._setFrom({ session_invites: invitesQB_upsertOK });

      const res = await request(app).get("/api/sessions/10/accept/user-456");
      expect(res.status).toBe(200);
    });

    test("decline returns 200", async () => {
      const { invitesQB_upsertOK } = supabaseMock.__builders;
      supabaseMock._setFrom({ session_invites: invitesQB_upsertOK });

      const res = await request(app).get("/api/sessions/10/decline/user-456");
      expect(res.status).toBe(200);
    });
  });

  //
  // POST /groups/:groupId/sessions/:sessionId/respond
  //
  describe("POST /api/groups/:groupId/sessions/:sessionId/respond", () => {
    test("401 when no token", async () => {
      supabaseMock.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });

      const res = await request(app)
        .post("/api/groups/1/sessions/10/respond")
        .send({ status: "accepted" });

      expect(res.status).toBe(401);
    });

    test("400 invalid status", async () => {
      const { groupMembersQB_allow, fetchOwnQB, invitesQB_upsertOK } = supabaseMock.__builders;

      supabaseMock.auth.getUser.mockReset();
      supabaseMock.auth.getUser.mockImplementation(async (token) => {
        if (!token) return { data: { user: null }, error: null };
        return { data: { user: { id: 'user-123', email: 'creator@test.com' } }, error: null };
      });

      supabaseMock._setFrom({
        group_members: groupMembersQB_allow,
        sessions: fetchOwnQB,
        session_invites: invitesQB_upsertOK,
      });

      const res = await request(app)
        .post("/api/groups/1/sessions/10/respond")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "maybe" });

      expect(res.status).toBe(400);
    });

    test("403 when not a group member", async () => {
      const { groupMembersQB_deny, insertSessionQB } = supabaseMock.__builders;
      supabaseMock._setFrom({
        group_members: groupMembersQB_deny,
        sessions: insertSessionQB,
      });

      supabaseMock.auth.getUser.mockImplementationOnce(async (token) => {
        if (!token) return { data: { user: null }, error: null };
        return { data: { user: supabaseMock._user }, error: null };
      });

      const res = await request(app)
        .post("/api/groups/1/sessions")
        .set("Authorization", `Bearer ${token}`)
        .send({ start_at: "2099-12-25T10:00:00Z" });

      expect(res.status).toBe(403);
    });

    test("200 on declined (upsert invite)", async () => {
      const {
        groupMembersQB_allow,
        fetchOwnQB,
        invitesQB_upsertOK,
      } = supabaseMock.__builders;

      supabaseMock.from = jest.fn((table) => {
        if (table === "group_members") return groupMembersQB_allow;
        if (table === "sessions") return fetchOwnQB;
        if (table === "session_invites") return invitesQB_upsertOK;
        return makeQB();
      });

      const res = await request(app)
        .post("/api/groups/1/sessions/10/respond")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "declined" });

      expect(res.status).toBe(200);
    });
  });

  //
  // GROUP MESSAGES
  //
  describe("Group messages endpoints", () => {
    test("POST /groups/:groupId/messages 400 when both content & attachment are missing", async () => {
      const { groupMembersQB_allow, groupMessagesQB_insertSingle } = supabaseMock.__builders;

      supabaseMock._setFrom({
        group_members: groupMembersQB_allow,
        group_messages: groupMessagesQB_insertSingle,
      });

      const res = await request(app)
        .post("/api/groups/1/messages")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    test("POST /groups/:groupId/messages inserts and returns message", async () => {
      const { groupMembersQB_allow, groupMessagesQB_insertSingle } = supabaseMock.__builders;

      supabaseMock._setFrom({
        group_members: groupMembersQB_allow,
        group_messages: groupMessagesQB_insertSingle,
      });

      const res = await request(app)
        .post("/api/groups/1/messages")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "posted", session_id: 10 });

      expect(res.status).toBe(200);
      const idx = supabaseMock.from.mock.calls.findIndex(c => c && c[0] === "group_messages");
      const qb = supabaseMock.from.mock.results[idx].value;
      expect(qb.insert).toHaveBeenCalled();
    });

    test("GET /groups/:groupId/messages (no query) returns enriched messages", async () => {
      const { groupMembersQB_allow, groupMessagesQB_list, profilesQB_enrich } = supabaseMock.__builders;

      supabaseMock._setFrom({
        group_members: groupMembersQB_allow,
        group_messages: groupMessagesQB_list,
        profiles: profilesQB_enrich,
      });

      const res = await request(app)
        .get("/api/groups/1/messages")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      const idx = supabaseMock.from.mock.calls.findIndex(c => c && c[0] === "group_messages");
      const qb = supabaseMock.from.mock.results[idx].value;
      expect(qb.select).toHaveBeenCalled();
      expect(qb.eq).toHaveBeenCalledWith("group_id", "1");
      expect(qb.order).toHaveBeenCalledWith("created_at", expect.any(Object));
      expect(qb.limit).toHaveBeenCalled();
    });

    test("GET /groups/:groupId/messages?sessionId=11 applies eq('session_id', ...)", async () => {
      const { groupMembersQB_allow, groupMessagesQB_listForSession, profilesQB_enrich } = supabaseMock.__builders;

      supabaseMock._setFrom({
        group_members: groupMembersQB_allow,
        group_messages: groupMessagesQB_listForSession,
        profiles: profilesQB_enrich,
      });

      const res = await request(app)
        .get("/api/groups/1/messages?sessionId=11&limit=50")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      const idx = supabaseMock.from.mock.calls.findIndex(c => c && c[0] === "group_messages");
      const qb = supabaseMock.from.mock.results[idx].value;
      expect(qb.eq).toHaveBeenCalledWith("group_id", "1");
      expect(qb.eq).toHaveBeenCalledWith("session_id", "11");
    });
  });
});

// new emailJS tests

describe("Sessions service utility endpoints", () => {
  test("GET /api/health returns status OK", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("OK");
    expect(res.body.message).toBe("Service is running");
    expect(res.body.timestamp).toBeDefined();
  });

  test("GET /api/emailJS-test returns 200 for invitation test", async () => {
    const res = await request(app)
      .get("/api/emailJS-test")
      .query({ email: "test@example.com", type: "invitation" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("invitation");
  });

  test("GET /api/emailJS-test returns 200 for conflict test", async () => {
    const res = await request(app)
      .get("/api/emailJS-test")
      .query({ email: "test@example.com", type: "conflict" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("conflict");
  });

  test("GET /api/emailJS-test-both returns 200 and summary includes invitation/conflict", async () => {
    const res = await request(app)
      .get("/api/emailJS-test-both")
      .query({ email: "test@example.com" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.results).toBeInstanceOf(Array);
    expect(Object.keys(res.body.summary)).toEqual(
      expect.arrayContaining(["invitation", "conflict"])
    );
  });
});


