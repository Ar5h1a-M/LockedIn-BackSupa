// src/swagger.js
import swaggerJSDoc from "swagger-jsdoc";

const swaggerDefinition = {
  openapi: "3.0.3",
  info: {
    title: "LockedIn API",
    version: "1.0.0",
    description:
      "Public OpenAPI docs for the LockedIn backend. Auth: Bearer token from Supabase.",
  },
  servers: [
    { url: "https://lockedin-backsupa.onrender.com", description: "Production" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      
    },
    schemas: {
      // Reusable shapes (trimmed to essentials so it stays readable)
      Profile: {
        type: "object",
        properties: {
          id: { type: "string" },
          full_name: { type: "string", nullable: true },
          email: { type: "string", format: "email" },
          degree: { type: "string", nullable: true },
          modules: { type: "array", items: { type: "string" } },
          interest: { type: "string", nullable: true },
        },
      },
      Group: {
        type: "object",
        properties: {
          id: { type: "integer" },
          owner_id: { type: "string" },
          name: { type: "string" },
          module: { type: "string", nullable: true },
          created_at: { type: "string", format: "date-time" },
        },
      },
      Session: {
        type: "object",
        properties: {
          id: { type: "integer" },
          group_id: { type: "integer" },
          creator_id: { type: "string" },
          start_at: { type: "string", format: "date-time" },
          venue: { type: "string", nullable: true },
          topic: { type: "string", nullable: true },
          time_goal_minutes: { type: "integer", nullable: true },
          content_goal: { type: "string", nullable: true },
        },
      },
      GroupMessage: {
        type: "object",
        properties: {
          id: { type: "integer" },
          group_id: { type: "integer" },
          session_id: { type: "integer", nullable: true },
          sender_id: { type: "string" },
          content: { type: "string", nullable: true },
          attachment_url: { type: "string", nullable: true },
          created_at: { type: "string", format: "date-time" },
          sender_name: { type: "string", nullable: true },
        },
      },
      Invitation: {
        type: "object",
        properties: {
          id: { type: "integer" },
          sender_id: { type: "string" },
          recipient_id: { type: "string" },
          status: { type: "string", enum: ["pending", "accepted", "declined"] },
          sent_at: { type: "string", format: "date-time" },
        },
      },
      GroupInvitation: {
        type: "object",
        properties: {
          id: { type: "integer" },
          group_id: { type: "integer" },
          sender_id: { type: "string" },
          recipient_id: { type: "string" },
          status: { type: "string", enum: ["pending", "accepted", "declined"] },
          sent_at: { type: "string", format: "date-time" },
          group_name: { type: "string", nullable: true },
          group_module: { type: "string", nullable: true },
          group_owner_id: { type: "string", nullable: true },
        },
      },
      ProgressEntry: {
        type: "object",
        properties: {
          date: { type: "string", format: "date" },
          hours: { type: "number" },
          productivity: { type: "integer", nullable: true },
          notes: { type: "string", nullable: true },
        },
      },
    },
  },
};

export const swaggerOptions = {
  definition: swaggerDefinition,
  // Point to your route files so swagger-jsdoc can gather the JSDoc blocks
  apis: [
    "./routes/**/*.js",
    "./src/routes/**/*.js",
    "./routes/*.js",
    "./src/routes/*.js",
  ],
};

export function buildOpenApiSpec() {
  return swaggerJSDoc(swaggerOptions);
}
