// tests/integration/session-lifecycle.test.js

// Load environment variables
import { config } from 'dotenv';
config({ path: '.env.test' });

// Verify environment variables are loaded
console.log('SUPABASE_URL loaded:', !!process.env.SUPABASE_URL);
console.log('SERVICE_ROLE_KEY loaded:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);


import request from 'supertest';

let app;
let testDb;

beforeAll(async () => {
  const mod = await import('../../src/server.js');
  app = mod.default || mod;
  
  const TestDatabase = (await import('../setup/test-db.js')).default;
  testDb = new TestDatabase();
});

afterAll(async () => {
  await testDb.cleanup();
});

describe('Session Lifecycle Integration Tests', () => {
  let authToken;
  let testGroup;

  beforeEach(async () => {
    const testUser = await testDb.createTestUser();
    authToken = await testDb.getAuthToken();
    testGroup = await testDb.createTestGroup(testUser.auth.id);
  });

  afterEach(async () => {
    await testDb.cleanup();
  });

  test('Complete session lifecycle: create, list, delete', async () => {
    // 1. Create a session
    const sessionData = {
      start_at: "2099-12-25T10:00:00Z",
      venue: "Library",
      topic: "Integration Test Session",
      time_goal_minutes: 120,
      content_goal: "Complete integration testing"
    };

    const createResponse = await request(app)
      .post(`/api/groups/${testGroup.id}/sessions`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(sessionData);

    expect(createResponse.status).toBe(200);
    expect(createResponse.body.session.topic).toBe(sessionData.topic);
    
    const sessionId = createResponse.body.session.id;

    // 2. List sessions
    const listResponse = await request(app)
      .get(`/api/groups/${testGroup.id}/sessions`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.sessions).toContainEqual(
      expect.objectContaining({
        id: sessionId,
        topic: sessionData.topic
      })
    );

    // 3. Delete session
    const deleteResponse = await request(app)
      .delete(`/api/groups/${testGroup.id}/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(deleteResponse.status).toBe(200);

    // 4. Verify session is gone
    const finalListResponse = await request(app)
      .get(`/api/groups/${testGroup.id}/sessions`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(finalListResponse.body.sessions).not.toContainEqual(
      expect.objectContaining({ id: sessionId })
    );
  });

  test('Session creation fails for non-group members', async () => {
    // Create a different user who is not in the group
    const otherUser = await testDb.createTestUser();
    const otherUserToken = await testDb.getAuthToken();

    const sessionData = {
      start_at: "2099-12-25T10:00:00Z",
      venue: "Library",
      topic: "Should Fail"
    };

    const response = await request(app)
      .post(`/api/groups/${testGroup.id}/sessions`)
      .set('Authorization', `Bearer ${otherUserToken}`)
      .send(sessionData);

    expect(response.status).toBe(403);
  });
});