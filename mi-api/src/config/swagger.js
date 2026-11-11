const path = require("node:path");
const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Mi API - Usuarios",
      version: "1.0.0",
      description: "API REST para administrar usuarios."
    },
    servers: [{ url: "http://localhost:3000", description: "Servidor local" }],
    components: {
      schemas: {
        Usuario: {
          type: "object",
          required: ["id", "nombre"],
          properties: {
            id: { type: "integer", example: 1 },
            nombre: { type: "string", example: "Ana Pérez" },
            edad: { type: "integer", nullable: true, example: 28 },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" }
          }
        },
        UsuarioInput: {
          type: "object",
          required: ["nombre"],
          properties: {
            nombre: { type: "string", minLength: 1, example: "Ana Pérez" },
            edad: { type: "integer", nullable: true, minimum: 0, example: 28 }
          }
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string", example: "Usuario no encontrado." }
          }
        }
      }
    }
  },
  apis: [path.resolve(__dirname, "../routes/*.js")]
};

module.exports = swaggerJsdoc(options);
