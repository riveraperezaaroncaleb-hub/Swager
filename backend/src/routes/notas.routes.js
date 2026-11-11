import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middlewares/validar.js";
import { notasController } from "../controllers/notas.controller.js";
import { iaController } from "../controllers/ia.controller.js";

const notaSchema = z.object({
  titulo: z.string().trim().min(1).max(100),
  contenido: z.string().trim().min(1),
  usuarioId: z.coerce.number().int().positive().optional()
}).strict();
const actualizarNotaSchema = z.object({
  titulo: z.string().trim().min(1).max(100).optional(),
  contenido: z.string().trim().min(1).optional(),
  usuarioId: z.coerce.number().int().positive().optional()
}).strict().refine((body) => Object.keys(body).length > 0, "Envía al menos un campo.");

export function createNotasRouter({
  summaryController = iaController,
  iaRateLimit = (_req, _res, next) => next()
} = {}) {
  const router = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     NotaInput:
 *       type: object
 *       required: [titulo, contenido]
 *       properties:
 *         titulo: { type: string, maxLength: 100, example: "Minuta de reunión" }
 *         contenido: { type: string, example: "Se revisaron los objetivos del trimestre." }
 *         usuarioId: { type: integer, minimum: 1, example: 1, nullable: true }
 *     Nota:
 *       allOf:
 *         - $ref: '#/components/schemas/NotaInput'
 *         - type: object
 *           properties:
 *             id: { type: integer, example: 1 }
 *     Error:
 *       type: object
 *       properties:
 *         error: { type: string, example: "Nota no encontrada." }
 */

/**
 * @openapi
 * /api/notas:
 *   get:
 *     summary: Lista las notas con su usuario propietario
 *     tags: [Notas]
 *     responses:
 *       200:
 *         description: Notas encontradas.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notas:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Nota' }
 */
  router.get("/", notasController.listar);

/**
 * @openapi
 * /api/notas:
 *   post:
 *     summary: Crea una nota asociada a un usuario
 *     tags: [Notas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/NotaInput' }
 *     responses:
 *       201: { description: Nota creada. }
 *       400: { description: Datos inválidos. }
 *       404: { description: Usuario no encontrado. }
 */
  router.post("/", validateBody(notaSchema), notasController.crear);

/**
 * @openapi
 * /api/notas/{id}:
 *   put:
 *     summary: Actualiza título, contenido o propietario de una nota
 *     tags: [Notas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               titulo: { type: string, maxLength: 100 }
 *               contenido: { type: string }
 *               usuarioId: { type: integer, minimum: 1 }
 *     responses:
 *       200: { description: Nota actualizada. }
 *       400: { description: Datos inválidos. }
 *       404: { description: Nota o usuario no encontrado. }
 */
  router.put("/:id", validateBody(actualizarNotaSchema), notasController.actualizar);

/**
 * @openapi
 * /api/notas/{id}:
 *   get:
 *     summary: Obtiene una nota por ID
 *     tags: [Notas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200: { description: Nota encontrada. }
 *       400: { description: ID inválido. }
 *       404: { description: Nota no encontrada. }
 */
  router.get("/:id", notasController.obtenerPorId);

/**
 * @openapi
 * /api/notas/{id}:
 *   delete:
 *     summary: Elimina una nota
 *     tags: [Notas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200: { description: Nota eliminada. }
 *       400: { description: ID inválido. }
 *       404: { description: Nota no encontrada. }
 */
  router.delete("/:id", notasController.eliminar);

/**
 * @openapi
 * /api/notas/{id}/resumen:
 *   post:
 *     summary: Genera un resumen de tres viñetas con Claude y registra su consumo
 *     tags: [IA]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200: { description: Resumen y tokens reportados por Claude. }
 *       404: { description: Nota no encontrada. }
 *       502: { description: Error del proveedor de IA. }
 */
  router.post("/:id/resumen", iaRateLimit, summaryController.resumirNota);
  router.post("/:id/summarize", iaRateLimit, summaryController.resumirNota);

  return router;
}

export default createNotasRouter();
