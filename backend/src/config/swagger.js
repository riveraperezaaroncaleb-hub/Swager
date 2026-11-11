import swaggerJsdoc from "swagger-jsdoc";
import { fileURLToPath } from "node:url";
import path from "node:path";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "DocuAI Enterprise API",
      version: "1.0.0",
      description: "API REST de usuarios, notas y auditoría de interacciones con Claude."
    },
    servers: [{ url: "http://localhost:3000" }]
  },
  apis: [path.resolve(currentDirectory, "../routes/*.js").replace(/\\/g, "/")]
});
