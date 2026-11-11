import Anthropic from "@anthropic-ai/sdk";
import { streamClaude } from "../services/claude.service.js";
import { obtenerNotaPorId } from "../services/notas.service.js";
import { AppError } from "../utils/errors.js";
import { prisma } from "../lib/prisma.js";

const systemMessage = {
  role: "system",
  content: "Eres el asistente de DocuAI Enterprise. Responde en español, con claridad y precisión. Ayuda con preguntas, notas y minutas; no inventes datos."
};

function sendEvent(res, event) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function createConversationTitle(question) {
  const title = question.replace(/\s+/g, " ").trim();
  return title.length > 70 ? `${title.slice(0, 67)}...` : title;
}

export function createIAController({
  db = prisma,
  streamAI = streamClaude
} = {}) {
  return {
    async listarHistorial(req, res, next) {
      try {
        const take = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
        const historial = await db.historialIA.findMany({
          where: req.query.tipo ? { tipo: String(req.query.tipo) } : undefined,
          orderBy: { createdAt: "desc" },
          take
        });
        res.json({ historial });
      } catch (error) {
        next(error);
      }
    },

    async obtenerRegistroHistorial(req, res, next) {
      try {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id <= 0) {
          throw new AppError("El ID debe ser un entero positivo.", 400);
        }
        const registro = await db.historialIA.findUnique({ where: { id } });
        if (!registro) throw new AppError("Registro de historial no encontrado.", 404);
        res.json({ registro });
      } catch (error) {
        next(error);
      }
    },

    async listarConversaciones(_req, res, next) {
      try {
        const conversaciones = await db.conversacion.findMany({
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            titulo: true,
            updatedAt: true,
            _count: { select: { mensajes: true } }
          }
        });
        res.json({ conversaciones });
      } catch (error) {
        next(error);
      }
    },

    async obtenerConversacion(req, res, next) {
      try {
        const conversacion = await db.conversacion.findUnique({
          where: { id: req.params.id },
          include: { mensajes: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } }
        });
        if (!conversacion) throw new AppError("Conversación no encontrada.", 404);
        res.json({ conversacion });
      } catch (error) {
        next(error);
      }
    },

    async actualizarConversacion(req, res, next) {
      try {
        const result = await db.conversacion.updateMany({
          where: { id: req.params.id },
          data: { titulo: req.body.titulo }
        });
        if (result.count === 0) throw new AppError("Conversación no encontrada.", 404);
        const conversacion = await db.conversacion.findUnique({
          where: { id: req.params.id },
          select: { id: true, titulo: true, updatedAt: true }
        });
        res.json({ conversacion });
      } catch (error) {
        next(error);
      }
    },

    async eliminarConversacion(req, res, next) {
      try {
        const result = await db.conversacion.deleteMany({ where: { id: req.params.id } });
        if (result.count === 0) throw new AppError("Conversación no encontrada.", 404);
        res.json({ message: "Conversación eliminada correctamente." });
      } catch (error) {
        next(error);
      }
    },

    async preguntar(req, res, next) {
      let abortController;
      try {
        const question = req.body.pregunta;
        const usuarioId = req.body.usuarioId ?? null;
        if (usuarioId !== null) {
          const user = await db.usuario.findUnique({ where: { id: usuarioId } });
          if (!user) throw new AppError("El usuario indicado no existe.", 404);
        }

        let conversacion;
        if (req.body.conversacionId) {
          conversacion = await db.conversacion.findUnique({
            where: { id: req.body.conversacionId }
          });
          if (!conversacion) throw new AppError("Conversación no encontrada.", 404);
        } else {
          conversacion = await db.conversacion.create({
            data: {
              titulo: createConversationTitle(question),
              usuarioId
            }
          });
        }

        const previousMessages = await db.chatMessage.findMany({
          where: { conversacionId: conversacion.id },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { role: true, content: true }
        });
        await db.chatMessage.create({
          data: {
            role: "user",
            content: question,
            conversacionId: conversacion.id
          }
        });

        res.status(200);
        res.set({
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no"
        });
        res.flushHeaders();
        sendEvent(res, { type: "conversation", conversationId: conversacion.id });

        abortController = new AbortController();
        res.on("close", () => {
          if (!res.writableEnded) abortController.abort();
        });

        const messages = [
          systemMessage,
          ...previousMessages.map(({ role, content }) => ({ role, content })),
          { role: "user", content: question }
        ];
        let answer = "";
        let usage = { inputTokens: 0, outputTokens: 0 };
        let model = process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001";

        for await (const event of streamAI(messages, { signal: abortController.signal })) {
          if (event.type === "delta") {
            answer += event.text;
            sendEvent(res, { type: "delta", text: event.text });
          } else if (event.type === "done") {
            usage = event.usage || usage;
            model = event.model || model;
          }
        }

        if (!answer.trim()) throw new AppError("Claude devolvió una respuesta vacía.", 502);

        await db.$transaction([
          db.chatMessage.create({
            data: {
              role: "assistant",
              content: answer,
              conversacionId: conversacion.id
            }
          }),
          db.historialIA.create({
            data: {
              tipo: "preguntar",
              promptEntrada: question,
              respuestaSalida: answer,
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              modeloUsado: model,
              usuarioId,
              conversacionId: conversacion.id
            }
          }),
          db.conversacion.update({
            where: { id: conversacion.id },
            data: { updatedAt: new Date() }
          })
        ]);

        sendEvent(res, {
          type: "done",
          conversationId: conversacion.id,
          uso: { ...usage, modeloUsado: model }
        });
        res.end();
      } catch (error) {
        if (res.headersSent) {
          if (!res.destroyed && !res.writableEnded) {
            sendEvent(res, {
              type: "error",
              error: error instanceof Anthropic.APIError
                ? (error.status === 429 ? "IA_LIMITE_ALCANZADO" : "IA_NO_DISPONIBLE")
                : error.code || "IA_NO_DISPONIBLE"
            });
            res.end();
          }
          return;
        }
        next(error);
      }
    },

    async resumirNota(req, res, next) {
      try {
        const notaId = Number(req.params.id);
        if (!Number.isSafeInteger(notaId) || notaId < 1) {
          throw new AppError("El ID debe ser un entero positivo.", 400);
        }
        const nota = await obtenerNotaPorId(notaId, db);

        const prompt = [
          "Resume esta nota en español usando exactamente tres viñetas.",
          "Conserva las ideas principales y no agregues datos externos.",
          `Título: ${nota.titulo}`,
          `Contenido: ${nota.contenido}`
        ].join("\n\n");
        let answer = "";
        let usage = { inputTokens: 0, outputTokens: 0 };
        let model = process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001";
        const messages = [systemMessage, { role: "user", content: prompt }];

        for await (const event of streamAI(messages)) {
          if (event.type === "delta") answer += event.text;
          if (event.type === "done") {
            usage = event.usage || usage;
            model = event.model || model;
          }
        }
        if (!answer.trim()) throw new AppError("Claude devolvió una respuesta vacía.", 502);

        const [historialIA] = await db.$transaction([
          db.historialIA.create({
            data: {
              tipo: "resumen",
              promptEntrada: prompt,
              respuestaSalida: answer,
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              modeloUsado: model,
              notaId,
              usuarioId: nota.usuarioId
            }
          }),
          db.nota.update({
            where: { id: notaId },
            data: { updatedAt: new Date() }
          })
        ]);
        res.json({
          notaId,
          resumen: answer,
          uso: { ...usage, modeloUsado: model },
          historialId: historialIA.id
        });
      } catch (error) {
        next(error);
      }
    }
  };
}

export const iaController = createIAController();
