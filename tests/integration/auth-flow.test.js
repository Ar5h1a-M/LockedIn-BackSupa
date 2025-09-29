// tests/integration/auth-flow.test.js

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
  // Import your app AFTER environment variables are loaded
  const mod = await import('../../src/server.js');
  app = mod.default || mod;
  
  const TestDatabase = (await import('../setup/test-db.js')).default;
  testDb = new TestDatabase();
});

afterAll(async () => {
  await testDb.cleanup();
});

describe('Authentication Flow Integration Tests', () => {
  let authToken;
  let testUser;

  beforeEach(async () => {
    testUser = await testDb.createTestUser();
    authToken = await testDb.getAuthToken();
  });

  afterEach(async () => {
    await testDb.cleanup();
  });

  test('User can authenticate and access protected routes', async () => {
    // Test accessing protected route with valid token
    const profileResponse = await request(app)
      .get('/api/profile')
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.profile.email).toBe(testUser.auth.email);
  });

  test('User cannot access protected routes without token', async () => {
    const response = await request(app)
      .get('/api/profile');
    
    expect(response.status).toBe(401);
  });

  test('User cannot access protected routes with invalid token', async () => {

    
    const response = await request(app)
      .get('/api/profile')
      .set('Authorization', 'Bearer invalid-token');
    
    expect(response.status).toBe(500);
  });
});