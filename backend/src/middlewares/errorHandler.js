import Anthropic from "@anthropic-ai/sdk";
import { AppError } from "../utils/errors.js";

export function errorHandler(error, _req, res, _next) {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "El cuerpo de la solicitud no es JSON válido." });
  }

  if (error.code === "P2002") {
    return res.status(409).json({ error: "Ya existe un registro con esos datos únicos." });
  }
  if (error.code === "P2003") {
    return res.status(400).json({ error: "La referencia indicada no es válida." });
  }
  if (error.code === "P2025") {
    return res.status(404).json({ error: "El registro solicitado no existe." });
  }

  if (error instanceof Anthropic.APIError) {
    const statusCode = error.status === 429 ? 429 : error.status === 529 ? 503 : 502;
    const code = error.status === 429 ? "IA_LIMITE_ALCANZADO" : "IA_NO_DISPONIBLE";
    console.error("Fallo de Anthropic", {
      status: error.status,
      requestID: error.requestID
    });
    return res.status(statusCode).json({ error: code });
  }

  const status = error instanceof AppError ? error.statusCode : 500;
  if (status >= 500) console.error(error);
  return res.status(status).json({
    error: error.code || (status === 500 ? "Error interno del servidor." : error.message)
  });
}
