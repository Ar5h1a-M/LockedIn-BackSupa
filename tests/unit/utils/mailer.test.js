//tests\utils\mailer.test.js

import { jest } from "@jest/globals";

describe("Mailer Utility", () => {
  let mailer;
  let nodemailerMock;

  beforeAll(async () => {
    // Set env vars first
    process.env.SMTP_HOST = "smtp.test.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "test@test.com";
    process.env.SMTP_PASS = "testpass";

    // Create a mock function
    const mockCreateTransport = jest.fn(() => ({ mockTransporter: true }));
    
    // Mock nodemailer
    jest.mock("nodemailer", () => ({
      createTransport: mockCreateTransport
    }));

    // Dynamically import AFTER mocking
    const mod = await import("../../../src/utils/mailer.js");
    mailer = mod;
    
    // Get the mocked module using dynamic import
    nodemailerMock = await import("nodemailer");
  });

  test("transporter should be created with correct config", () => {
    expect(nodemailerMock.createTransport).toHaveBeenCalledWith({
      host: "smtp.test.com",
      port: "587",
      secure: false,
      auth: {
        user: "test@test.com",
        pass: "testpass",
      },
    });
  });

  test("transporter should be exported", () => {
    expect(mailer.transporter).toBeDefined();
    expect(mailer.transporter.mockTransporter).toBe(true);
  });
});