import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";

export async function obtenerNotaPorId(value, db = prisma, include) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new AppError("El ID debe ser un entero positivo.", 400);
  }

  const nota = await db.nota.findUnique({
    where: { id },
    ...(include && { include })
  });
  if (!nota) throw new AppError("Nota no encontrada.", 404);
  return nota;
}
