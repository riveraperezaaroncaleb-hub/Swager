import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middlewares/validar.js";
import { createIAController } from "../controllers/ia.controller.js";

const preguntarSchema = z.object({
  pregunta: z.string().trim().min(1).max(5000).optional(),
  question: z.string().trim().min(1).max(5000).optional(),
  conversacionId: z.string().min(1).optional(),
  conversationId: z.string().min(1).optional(),
  usuarioId: z.coerce.number().int().positive().optional()
}).strict().transform((body, context) => {
  const pregunta = body.pregunta ?? body.question;
  if (!pregunta) {
    context.addIssue({ code: "custom", message: "El campo pregunta es obligatorio." });
    return z.NEVER;
  }
  return {
    pregunta,
    conversacionId: body.conversacionId ?? body.conversationId,
    usuarioId: body.usuarioId
  };
});
const conversationTitleSchema = z.object({
  titulo: z.string().trim().min(1).max(100)
}).strict();

export function createIARouter(options = {}) {
  const router = Router();
  const controller = options.controller ?? createIAController(options);

  /**
   * @openapi
   * components:
   *   schemas:
   *     PreguntaIA:
   *       type: object
   *       required: [pregunta]
   *       properties:
   *         pregunta: { type: string, maxLength: 5000 }
   *         conversacionId: { type: string, description: ID devuelto al iniciar el chat }
   *         usuarioId: { type: integer, minimum: 1 }
   *     EventoStreaming:
   *       type: object
   *       properties:
   *         type: { type: string, enum: [conversation, delta, done, error] }
   *         text: { type: string }
   *         conversationId: { type: string }
   *         error: { type: string }
   */

  /**
   * @openapi
   * /api/ia/preguntar:
   *   post:
   *     summary: Envía una pregunta a Claude usando el historial de la conversación
   *     description: "Responde como Server-Sent Events. Cada evento se entrega como data: JSON."
   *     tags: [IA]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: '#/components/schemas/PreguntaIA' }
   *           examples:
   *             nueva:
   *               value: { pregunta: "Resume los acuerdos de hoy" }
   *             continuar:
   *               value: { pregunta: "¿Qué responsables mencionamos?", conversacionId: "ID_DEVUELTO_POR_EL_CHAT" }
   *     responses:
   *       200:
   *         description: Flujo SSE con eventos conversation, delta y done.
   *         content:
   *           text/event-stream:
   *             schema: { type: string, example: "data: {\"type\":\"delta\",\"text\":\"Hola\"}\n\n" }
   *       400: { description: Pregunta inválida. }
   *       404: { description: Conversación o usuario no encontrado. }
   *       429: { description: Límite de solicitudes alcanzado. }
   *       502: { description: Claude no está disponible o rechazó las credenciales. }
   */
  router.post("/preguntar", validateBody(preguntarSchema), controller.preguntar);
  router.post("/ask", validateBody(preguntarSchema), controller.preguntar);

  /**
   * @openapi
   * /api/ia/conversaciones:
   *   get:
   *     summary: Lista las conversaciones guardadas
   *     tags: [IA]
   *     responses:
   *       200:
   *         description: Conversaciones persistidas en SQLite.
   */
  router.get("/conversaciones", controller.listarConversaciones);
  /**
   * @openapi
   * /api/ia/historial:
   *   get:
   *     summary: Lista los registros de auditoría IA
   *     tags: [IA]
   *     parameters:
   *       - in: query
   *         name: tipo
   *         schema: { type: string, enum: [preguntar, resumen] }
   *       - in: query
   *         name: limit
   *         schema: { type: integer, minimum: 1, maximum: 100, default: 50 }
   *     responses:
   *       200: { description: Registros ordenados del más reciente al más antiguo. }
   */
  router.get("/historial", controller.listarHistorial);
  /**
   * @openapi
   * /api/ia/historial/{id}:
   *   get:
   *     summary: Obtiene un registro de auditoría IA
   *     tags: [IA]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: integer, minimum: 1 }
   *     responses:
   *       200: { description: Registro encontrado. }
   *       404: { description: Registro no encontrado. }
   */
  router.get("/historial/:id", controller.obtenerRegistroHistorial);

  /**
   * @openapi
   * /api/ia/conversaciones/{id}:
   *   get:
   *     summary: Obtiene una conversación y todos sus mensajes
   *     tags: [IA]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Conversación y mensajes. }
   *       404: { description: Conversación no encontrada. }
   */
  router.get("/conversaciones/:id", controller.obtenerConversacion);
  /**
   * @openapi
   * /api/ia/conversaciones/{id}:
   *   patch:
   *     summary: Cambia el título de una conversación
   *     tags: [IA]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [titulo]
   *             properties:
   *               titulo: { type: string, minLength: 1, maxLength: 100 }
   *     responses:
   *       200: { description: Conversación renombrada. }
   *       404: { description: Conversación no encontrada. }
   */
  router.patch(
    "/conversaciones/:id",
    validateBody(conversationTitleSchema),
    controller.actualizarConversacion
  );
  /**
   * @openapi
   * /api/ia/conversaciones/{id}:
   *   delete:
   *     summary: Elimina una conversación y sus mensajes
   *     tags: [IA]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Conversación eliminada. }
   *       404: { description: Conversación no encontrada. }
   */
  router.delete("/conversaciones/:id", controller.eliminarConversacion);
  return router;
}

export default createIARouter();
