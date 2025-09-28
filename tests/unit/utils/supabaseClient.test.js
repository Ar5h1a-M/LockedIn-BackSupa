// tests\utils\supabaseClient.test.js

import { jest } from "@jest/globals";

describe("Supabase Client Utility", () => {
  let supabaseClient;
  let supabaseMock;

  beforeAll(async () => {
    // Set env vars first
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

    // Create a mock function
    const mockCreateClient = jest.fn(() => ({ mockClient: true }));
    
    // Mock supabase
    jest.mock("@supabase/supabase-js", () => ({
      createClient: mockCreateClient
    }));

    // Dynamically import AFTER mocking
    const mod = await import("../../../src/utils/supabaseClient.js");
    supabaseClient = mod;
    
    // Get the mocked module using dynamic import
    supabaseMock = await import("@supabase/supabase-js");
  });

  test("should create client with correct parameters", () => {
    expect(supabaseMock.createClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "test-service-role-key"
    );
  });

  test("should export supabase client", () => {
    expect(supabaseClient.default).toBeDefined();
    expect(supabaseClient.default.mockClient).toBe(true);
  });
});