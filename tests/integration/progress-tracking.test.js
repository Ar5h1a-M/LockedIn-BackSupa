// tests/integration/progress-tracking.test.js

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

describe('Progress Tracking Integration Tests', () => {
  let authToken;

  beforeEach(async () => {
    await testDb.createTestUser();
    authToken = await testDb.getAuthToken();
  });

  afterEach(async () => {
    await testDb.cleanup();
  });

  test('Complete progress tracking flow', async () => {
    const progressEntry = {
      date: "2023-12-01",
      hours: 4.5,
      productivity: 4,
      notes: "Productive study session"
    };

    // 1. Create progress entry
    const createResponse = await request(app)
      .post('/api/progress')
      .set('Authorization', `Bearer ${authToken}`)
      .send(progressEntry);

    expect(createResponse.status).toBe(200);
    expect(createResponse.body.entry.hours).toBe(progressEntry.hours);

    // 2. Get progress entries
    const getResponse = await request(app)
      .get('/api/progress')
      .set('Authorization', `Bearer ${authToken}`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.entries).toContainEqual(
      expect.objectContaining({
        date: progressEntry.date,
        hours: progressEntry.hours
      })
    );

    // 3. Update progress entry
    const updatedEntry = {
      date: "2023-12-01",
      hours: 5.0,
      productivity: 4,
      notes: "Updated - very productive"
    };

    const updateResponse = await request(app)
      .post('/api/progress')
      .set('Authorization', `Bearer ${authToken}`)
      .send(updatedEntry);

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.entry.hours).toBe(5.0);

    // 4. Get study time summary
    const studyTimeResponse = await request(app)
      .get('/api/study-time')
      .set('Authorization', `Bearer ${authToken}`);

    expect(studyTimeResponse.status).toBe(200);
    expect(studyTimeResponse.body).toHaveProperty('today');
    expect(studyTimeResponse.body).toHaveProperty('week');
  });
});