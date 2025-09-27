// progress.test.js

import { jest } from "@jest/globals";
import request from "supertest";

let app;
let supabaseMock;

// Mock nodemailer to prevent SMTP connection errors
jest.unstable_mockModule("nodemailer", () => ({
  default: {
    createTransport: () => ({
      verify: jest.fn().mockResolvedValue(true),
      sendMail: jest.fn().mockResolvedValue({ accepted: ["test@example.com"] }),
    }),
  },
  createTransport: () => ({
    verify: jest.fn().mockResolvedValue(true),
    sendMail: jest.fn().mockResolvedValue({ accepted: ["test@example.com"] }),
  }),
}));

// Chainable Supabase query builder
const makeQB = (data = [], error = null) => {
  const qb = {
    select: jest.fn(() => qb),
    insert: jest.fn(() => qb),
    update: jest.fn(() => qb),
    delete: jest.fn(() => qb),
    upsert: jest.fn(() => qb),
    eq: jest.fn(() => qb),
    order: jest.fn(() => qb),
    limit: jest.fn(() => qb),
    single: jest.fn(() => qb),
  };

  // The actual query execution
  qb.then = jest.fn((onFulfilled, onRejected) => {
    if (error) {
      return Promise.resolve({ data: null, error }).then(onFulfilled, onRejected);
    }
    return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected);
  });

  return qb;
};

beforeAll(async () => {
  const user = { id: "user-123", email: "test@example.com" };

  // Create query builders for different scenarios
  const progressQB_success = makeQB([
    { date: "2023-01-01", hours: 4, productivity: 80, notes: "Good session" },
    { date: "2023-01-02", hours: 3, productivity: 70, notes: "Average session" }
  ]);

  const progressQB_empty = makeQB([]);

  const progressQB_error = makeQB(null, { message: "Database error" });

  // Fix the mock data to match the test expectation
  const upsertQB_success = makeQB(
    { date: "2023-01-03", hours: 5, productivity: 90, notes: "Excellent study session" }
  );

  const upsertQB_error = makeQB(null, { message: "Upsert failed" });

  // Mock for RPC call (study-time aggregation)
  const rpcMock = {
    aggregate_study_time: jest.fn(() => ({
      then: (onFulfilled) => Promise.resolve({
        data: [{ today: 2.5, week: 15.3, weekend: 8.2, month: 45.7 }],
        error: null
      }).then(onFulfilled)
    }))
  };

  supabaseMock = {
    auth: {
      getUser: jest.fn(async (token) => {
        if (token === "valid.token") {
          return { data: { user }, error: null };
        }
        return { data: { user: null }, error: null };
      }),
    },
    from: jest.fn((table) => {
      switch (table) {
        case "user_progress":
          return progressQB_success;
        default:
          return makeQB();
      }
    }),
    rpc: jest.fn((fnName) => {
      if (fnName === "aggregate_study_time") {
        return rpcMock.aggregate_study_time();
      }
      return { then: (onFulfilled) => Promise.resolve({ data: null, error: null }).then(onFulfilled) };
    }),
    // Helper to override table mocks for specific tests
    _setFrom: (mapping) => {
      supabaseMock.from = jest.fn((table) => mapping[table] || makeQB());
    },
    _setRpc: (mapping) => {
      supabaseMock.rpc = jest.fn((fnName) => {
        if (mapping[fnName]) {
          return mapping[fnName]();
        }
        return { then: (onFulfilled) => Promise.resolve({ data: null, error: null }).then(onFulfilled) };
      });
    },
    __builders: {
      progressQB_success,
      progressQB_empty,
      progressQB_error,
      upsertQB_success,
      upsertQB_error,
      rpcMock,
    },
  };

  jest.unstable_mockModule("@supabase/supabase-js", () => ({
    createClient: () => supabaseMock,
  }));

  const mod = await import("../src/server.js");
  app = mod.default || mod;
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/progress", () => {
  const token = "valid.token";

  test("returns 401 when unauthorized", async () => {
    const res = await request(app)
      .get("/api/progress")
      .set("Authorization", "Bearer invalid.token");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
  });

  test("returns 401 when no token provided", async () => {
    const res = await request(app)
      .get("/api/progress");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
  });

  test("returns recent progress entries with valid token", async () => {
    const { progressQB_success } = supabaseMock.__builders;
    
    supabaseMock._setFrom({
      user_progress: progressQB_success,
    });

    const res = await request(app)
      .get("/api/progress")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("entries");
    expect(res.body.entries).toHaveLength(2);
    
    // Verify the query was built correctly
    expect(supabaseMock.from).toHaveBeenCalledWith("user_progress");
    const qb = supabaseMock.from.mock.results[0].value;
    expect(qb.select).toHaveBeenCalledWith("date, hours, productivity, notes");
    expect(qb.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(qb.order).toHaveBeenCalledWith("date", { ascending: false });
    expect(qb.limit).toHaveBeenCalledWith(14);
  });

  test("returns empty array when no progress entries found", async () => {
    const { progressQB_empty } = supabaseMock.__builders;
    
    supabaseMock._setFrom({
      user_progress: progressQB_empty,
    });

    const res = await request(app)
      .get("/api/progress")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ entries: [] });
  });

  test("handles database errors gracefully", async () => {
    const { progressQB_error } = supabaseMock.__builders;
    
    supabaseMock._setFrom({
      user_progress: progressQB_error,
    });

    const res = await request(app)
      .get("/api/progress")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error");
  });
});

describe("POST /api/progress", () => {
  const token = "valid.token";

  test("returns 401 when unauthorized", async () => {
    const res = await request(app)
      .post("/api/progress")
      .set("Authorization", "Bearer invalid.token")
      .send({ date: "2023-01-03", hours: 5 });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
  });

  test("returns 400 when date is missing", async () => {
    const res = await request(app)
      .post("/api/progress")
      .set("Authorization", `Bearer ${token}`)
      .send({ hours: 5 });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "date and hours required" });
  });

  test("returns 400 when hours is missing", async () => {
    const res = await request(app)
      .post("/api/progress")
      .set("Authorization", `Bearer ${token}`)
      .send({ date: "2023-01-03" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "date and hours required" });
  });

  test("returns 400 when both date and hours are missing", async () => {
    const res = await request(app)
      .post("/api/progress")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "date and hours required" });
  });

  test("successfully upserts progress entry with required fields", async () => {
    const { upsertQB_success } = supabaseMock.__builders;
    
    supabaseMock._setFrom({
      user_progress: upsertQB_success,
    });

    const progressData = {
      date: "2023-01-03",
      hours: 5
    };

    const res = await request(app)
      .post("/api/progress")
      .set("Authorization", `Bearer ${token}`)
      .send(progressData);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("entry");
    expect(res.body.entry.date).toBe("2023-01-03");
    expect(res.body.entry.hours).toBe(5);
    
    // Verify the upsert was called correctly
    expect(supabaseMock.from).toHaveBeenCalledWith("user_progress");
    const qb = supabaseMock.from.mock.results[0].value;
    expect(qb.upsert).toHaveBeenCalledWith([{
      user_id: "user-123",
      date: "2023-01-03",
      hours: 5,
      productivity: undefined,
      notes: undefined,
      updated_at: expect.any(String)
    }], {
      onConflict: "user_id,date",
    });
    expect(qb.select).toHaveBeenCalledWith("date, hours, productivity, notes");
    expect(qb.single).toHaveBeenCalled();
  });

  test("successfully upserts progress entry with all fields", async () => {
    const { upsertQB_success } = supabaseMock.__builders;
    
    supabaseMock._setFrom({
      user_progress: upsertQB_success,
    });

    const progressData = {
      date: "2023-01-03",
      hours: 5,
      productivity: 90,
      notes: "Excellent study session"
    };

    const res = await request(app)
      .post("/api/progress")
      .set("Authorization", `Bearer ${token}`)
      .send(progressData);

    expect(res.status).toBe(200);
    expect(res.body.entry.productivity).toBe(90);
    expect(res.body.entry.notes).toBe("Excellent study session");
    
    const qb = supabaseMock.from.mock.results[0].value;
    expect(qb.upsert).toHaveBeenCalledWith([{
      user_id: "user-123",
      date: "2023-01-03",
      hours: 5,
      productivity: 90,
      notes: "Excellent study session",
      updated_at: expect.any(String)
    }], {
      onConflict: "user_id,date",
    });
  });

  test("handles upsert errors gracefully", async () => {
    const { upsertQB_error } = supabaseMock.__builders;
    
    supabaseMock._setFrom({
      user_progress: upsertQB_error,
    });

    const res = await request(app)
      .post("/api/progress")
      .set("Authorization", `Bearer ${token}`)
      .send({ date: "2023-01-03", hours: 5 });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error");
  });
});

describe("GET /api/study-time", () => {
  const token = "valid.token";

  test("returns 401 when unauthorized", async () => {
    const res = await request(app)
      .get("/api/study-time")
      .set("Authorization", "Bearer invalid.token");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
  });

  test("returns formatted study time with valid token", async () => {
    supabaseMock._setRpc({
      aggregate_study_time: () => ({
        then: (onFulfilled) => Promise.resolve({
          data: [{ today: 2.5, week: 15.3, weekend: 8.2, month: 45.7 }],
          error: null
        }).then(onFulfilled)
      })
    });

    const res = await request(app)
      .get("/api/study-time")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      today: "2h 30m",
      week: "15h 18m",
      weekend: "8h 12m",
      month: "45h 42m"
    });
    
    // Verify RPC was called correctly
    expect(supabaseMock.rpc).toHaveBeenCalledWith("aggregate_study_time", {
      p_user_id: "user-123"
    });
  });

  test("handles zero study time correctly", async () => {
    supabaseMock._setRpc({
      aggregate_study_time: () => ({
        then: (onFulfilled) => Promise.resolve({
          data: [{ today: 0, week: 0, weekend: 0, month: 0 }],
          error: null
        }).then(onFulfilled)
      })
    });

    const res = await request(app)
      .get("/api/study-time")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      today: "0h 0m",
      week: "0h 0m",
      weekend: "0h 0m",
      month: "0h 0m"
    });
  });

  test("handles fractional hours correctly", async () => {
    supabaseMock._setRpc({
      aggregate_study_time: () => ({
        then: (onFulfilled) => Promise.resolve({
          data: [{ today: 1.25, week: 0.5, weekend: 2.75, month: 10.1 }],
          error: null
        }).then(onFulfilled)
      })
    });

    const res = await request(app)
      .get("/api/study-time")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      today: "1h 15m",
      week: "0h 30m",
      weekend: "2h 45m",
      month: "10h 6m"
    });
  });

  test("handles RPC errors gracefully", async () => {
    supabaseMock._setRpc({
      aggregate_study_time: () => ({
        then: (onFulfilled) => Promise.resolve({
          data: null,
          error: { message: "RPC error" }
        }).then(onFulfilled)
      })
    });

    const res = await request(app)
      .get("/api/study-time")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error");
  });

  test("handles empty RPC response", async () => {
    supabaseMock._setRpc({
      aggregate_study_time: () => ({
        then: (onFulfilled) => Promise.resolve({
          data: [],
          error: null
        }).then(onFulfilled)
      })
    });

    const res = await request(app)
      .get("/api/study-time")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      today: "0h 0m",
      week: "0h 0m",
      weekend: "0h 0m",
      month: "0h 0m"
    });
  });
});

// Test edge cases
describe("Progress Edge Cases", () => {
  const token = "valid.token";

  test("POST /api/progress with zero hours", async () => {
    const { upsertQB_success } = supabaseMock.__builders;
    
    supabaseMock._setFrom({
      user_progress: upsertQB_success,
    });

    const res = await request(app)
      .post("/api/progress")
      .set("Authorization", `Bearer ${token}`)
      .send({ date: "2023-01-03", hours: 0 });

    expect(res.status).toBe(200);
    // Zero hours should be allowed
  });

  test("POST /api/progress with negative hours", async () => {
    const { upsertQB_success } = supabaseMock.__builders;
    
    supabaseMock._setFrom({
      user_progress: upsertQB_success,
    });

    const res = await request(app)
      .post("/api/progress")
      .set("Authorization", `Bearer ${token}`)
      .send({ date: "2023-01-03", hours: -5 });

    expect(res.status).toBe(200);
    // Negative hours should be allowed (validation might be needed in production)
  });

  test("POST /api/progress with very large hours", async () => {
    const { upsertQB_success } = supabaseMock.__builders;
    
    supabaseMock._setFrom({
      user_progress: upsertQB_success,
    });

    const res = await request(app)
      .post("/api/progress")
      .set("Authorization", `Bearer ${token}`)
      .send({ date: "2023-01-03", hours: 24 });

    expect(res.status).toBe(200);
    // Large hours should be allowed
  });

  test("POST /api/progress with invalid date format", async () => {
    const { upsertQB_success } = supabaseMock.__builders;
    
    supabaseMock._setFrom({
      user_progress: upsertQB_success,
    });

    const res = await request(app)
      .post("/api/progress")
      .set("Authorization", `Bearer ${token}`)
      .send({ date: "invalid-date", hours: 5 });

    expect(res.status).toBe(200);
    // Date format validation might be needed in production
  });
});