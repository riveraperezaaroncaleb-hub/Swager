import express from "express";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger.js";
import { createNotasRouter } from "./routes/notas.routes.js";
import { createIARouter } from "./routes/ia.routes.js";
import { createIAController } from "./controllers/ia.controller.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { AppError } from "./utils/errors.js";
import usuariosRouter from "./routes/usuarios.js";
import { prisma } from "./lib/prisma.js";

export function createApp({
  db = prisma,
  streamAI,
  iaLimit = Number(process.env.IA_RATE_LIMIT_MAX) || 10,
  iaWindowMs = 15 * 60 * 1000
} = {}) {
  const app = express();
  const iaRateLimit = rateLimit({
    windowMs: iaWindowMs,
    limit: iaLimit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Límite de solicitudes de IA alcanzado. Inténtalo más tarde." }
  });
  const iaController = createIAController({ db, streamAI });
  const iaRouter = createIARouter({ controller: iaController });
  const notasRouter = createNotasRouter({ summaryController: iaController, iaRateLimit });

  app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
  app.use(express.json({ limit: "1mb" }));
  app.get("/api-docs.json", (_req, res) => res.json(swaggerSpec));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api/notas", notasRouter);
  app.use("/api/notes", notasRouter);
  app.use("/api/ia", iaRateLimit, iaRouter);
  app.use("/api/ai", iaRateLimit, iaRouter);
  app.use("/api/usuarios", usuariosRouter);
  app.use((_req, _res, next) => {
    next(new AppError("Ruta no encontrada.", 404));
  });
  app.use(errorHandler);

  return app;
}

const app = createApp();
export default app;
