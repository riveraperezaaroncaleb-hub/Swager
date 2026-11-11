import { AppError } from "../utils/AppError.js";

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

  const status = error instanceof AppError ? error.statusCode : 500;
  if (status >= 500) console.error(error);
  return res.status(status).json({
    error: status === 500 ? "Error interno del servidor." : error.message
  });
}
