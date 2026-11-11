import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import Anthropic from "@anthropic-ai/sdk";

process.env.DATABASE_URL = "file:./test.db";

const { PrismaClient } = await import("@prisma/client");
const { createApp } = await import("../src/app.js");
const prisma = new PrismaClient();
const generatedMessages = [];

async function* fakeClaude(messages) {
  generatedMessages.push(messages);
  const isSummary = messages.at(-1).content.includes("exactamente tres viñetas");
  yield {
    type: "delta",
    text: isSummary ? "- Punto uno.\n- Punto dos.\n- Punto tres." : "Respuesta "
  };
  if (!isSummary) yield { type: "delta", text: "simulada." };
  yield {
    type: "done",
    usage: { inputTokens: 7, outputTokens: 4 },
    model: "claude-test"
  };
}

async function clearDatabase() {
  await prisma.historialIA.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.conversacion.deleteMany();
  await prisma.nota.deleteMany();
  await prisma.usuario.deleteMany();
}

const app = createApp({ db: prisma, streamAI: fakeClaude, iaLimit: 20 });

before(async () => {
  await prisma.$connect();
  await clearDatabase();
});

after(async () => {
  await clearDatabase();
  await prisma.$disconnect();
});

test("valida la pregunta sin llamar al modelo", async () => {
  const callsBefore = generatedMessages.length;
  const response = await request(app)
    .post("/api/ia/preguntar")
    .send({ pregunta: "" });

  assert.equal(response.status, 400);
  assert.equal(generatedMessages.length, callsBefore);
});

test("transmite respuesta, persiste el chat y reutiliza sus mensajes previos", async () => {
  const first = await request(app)
    .post("/api/ia/preguntar")
    .set("Accept", "text/event-stream")
    .send({ pregunta: "¿Qué acordamos?" });

  assert.equal(first.status, 200);
  assert.match(first.headers["content-type"], /text\/event-stream/);
  assert.match(first.text, /"type":"delta","text":"Respuesta "/);
  assert.match(first.text, /"type":"done"/);

  const events = first.text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)));
  const conversationId = events.find((event) => event.type === "conversation")?.conversationId;
  assert.ok(conversationId);

  const saved = await prisma.conversacion.findUnique({
    where: { id: conversationId },
    include: { mensajes: { orderBy: { id: "asc" } }, historial: true }
  });
  assert.equal(saved.mensajes.length, 2);
  assert.equal(saved.mensajes[0].role, "user");
  assert.equal(saved.mensajes[1].role, "assistant");
  assert.equal(saved.historial.length, 1);
  assert.equal(saved.historial[0].inputTokens, 7);
  assert.equal(saved.historial[0].outputTokens, 4);

  const second = await request(app)
    .post("/api/ia/preguntar")
    .send({ pregunta: "¿Quién se encarga?", conversacionId: conversationId });
  assert.equal(second.status, 200);
  assert.ok(generatedMessages.at(-1).some(
    (message) => message.role === "assistant" && message.content === "Respuesta simulada."
  ));
  assert.ok(generatedMessages.at(-1).some(
    (message) => message.role === "user" && message.content === "¿Qué acordamos?"
  ));

  const transcript = await request(app).get(`/api/ia/conversaciones/${conversationId}`);
  assert.equal(transcript.status, 200);
  assert.equal(transcript.body.conversacion.mensajes.length, 4);

  const history = await request(app).get("/api/ia/historial");
  assert.equal(history.status, 200);
  assert.ok(history.body.historial.length >= 2);
  const historyId = history.body.historial[0].id;
  const historyEntry = await request(app).get(`/api/ia/historial/${historyId}`);
  assert.equal(historyEntry.status, 200);

  const renamedConversation = await request(app)
    .patch(`/api/ia/conversaciones/${conversationId}`)
    .send({ titulo: "Seguimiento del proyecto" });
  assert.equal(renamedConversation.status, 200);
  assert.equal(renamedConversation.body.conversacion.titulo, "Seguimiento del proyecto");

  const deletedConversation = await request(app)
    .delete(`/api/ia/conversaciones/${conversationId}`);
  assert.equal(deletedConversation.status, 200);
  const missingConversation = await request(app)
    .get(`/api/ia/conversaciones/${conversationId}`);
  assert.equal(missingConversation.status, 404);
});

test("aplica rate limit al endpoint de IA", async () => {
  const limitedApp = createApp({
    db: prisma,
    streamAI: fakeClaude,
    iaLimit: 1,
    iaWindowMs: 60_000
  });

  const first = await request(limitedApp)
    .post("/api/ia/preguntar")
    .send({ pregunta: "Pregunta dentro del límite" });
  const note = await prisma.nota.create({
    data: { titulo: "Minuta", contenido: "Resumen limitado.", usuarioId: null }
  });
  const second = await request(limitedApp).post(`/api/notas/${note.id}/resumen`);

  assert.equal(first.status, 200);
  assert.equal(second.status, 429);
  await prisma.nota.delete({ where: { id: note.id } });
});

test("CRUD de usuarios y notas persiste en SQLite", async () => {
  const createdUser = await request(app)
    .post("/api/usuarios")
    .send({
      nombre: "Ana Pruebas",
      email: "ana@example.test",
      password: "passphrase-larga"
    });
  assert.equal(createdUser.status, 201);
  assert.equal(Object.hasOwn(createdUser.body.usuario, "password"), false);
  const userId = createdUser.body.usuario.id;

  const listedUsers = await request(app).get("/api/usuarios");
  assert.equal(listedUsers.status, 200);
  assert.equal(listedUsers.body.usuarios.length, 1);
  const fetchedUser = await request(app).get(`/api/usuarios/${userId}`);
  assert.equal(fetchedUser.status, 200);

  const updatedUser = await request(app)
    .put(`/api/usuarios/${userId}`)
    .send({ nombre: "Ana Actualizada" });
  assert.equal(updatedUser.status, 200);
  assert.equal(updatedUser.body.usuario.nombre, "Ana Actualizada");

  const createdNote = await request(app)
    .post("/api/notas")
    .send({
      titulo: "Minuta inicial",
      contenido: "Acordar el calendario del proyecto.",
      usuarioId: userId
    });
  assert.equal(createdNote.status, 201);
  const noteId = createdNote.body.nota.id;
  const fetchedNote = await request(app).get(`/api/notas/${noteId}`);
  assert.equal(fetchedNote.status, 200);

  const updatedNote = await request(app)
    .put(`/api/notas/${noteId}`)
    .send({ titulo: "Minuta actualizada" });
  assert.equal(updatedNote.status, 200);
  assert.equal(updatedNote.body.nota.titulo, "Minuta actualizada");

  const listedNotes = await request(app).get("/api/notas");
  assert.equal(listedNotes.status, 200);
  assert.equal(listedNotes.body.notas.length, 1);

  const deletedNote = await request(app).delete(`/api/notas/${noteId}`);
  assert.equal(deletedNote.status, 200);
  const missingNote = await request(app).get(`/api/notas/${noteId}`);
  assert.equal(missingNote.status, 404);
  const invalidNote = await request(app).post("/api/notas").send({ titulo: "", contenido: "" });
  assert.equal(invalidNote.status, 400);
  const deletedUser = await request(app).delete(`/api/usuarios/${userId}`);
  assert.equal(deletedUser.status, 200);
  const missingUser = await request(app).get(`/api/usuarios/${userId}`);
  assert.equal(missingUser.status, 404);
});

test("crea una nota sin propietario y resume mediante el servicio Claude", async () => {
  const created = await request(app)
    .post("/api/notas")
    .send({ titulo: "Resumen de prueba", contenido: "Decisiones y próximos pasos." });
  assert.equal(created.status, 201);
  assert.equal(created.body.nota.usuarioId, null);

  const response = await request(app).post(`/api/notas/${created.body.nota.id}/resumen`);
  assert.equal(response.status, 200);
  assert.equal((response.body.resumen.match(/^- /gm) || []).length, 3);
  assert.equal(response.body.uso.modeloUsado, "claude-test");

  const history = await prisma.historialIA.findUnique({
    where: { id: response.body.historialId }
  });
  assert.equal(history.tipo, "resumen");
  assert.equal(history.notaId, created.body.nota.id);
  assert.match(history.promptEntrada, /exactamente tres viñetas/);

  await request(app).delete(`/api/notas/${created.body.nota.id}`);
});

test("traduce errores Anthropic 401, 429 y 529 a respuestas seguras", async () => {
  const cases = [
    {
      error: new Anthropic.AuthenticationError(
        401, { type: "authentication_error", message: "Invalid API key" }, "Unauthorized", new Headers()
      ),
      status: 502,
      body: { error: "IA_NO_DISPONIBLE" }
    },
    {
      error: new Anthropic.RateLimitError(
        429, { type: "rate_limit_error", message: "Rate limited" }, "Rate limited", new Headers()
      ),
      status: 429,
      body: { error: "IA_LIMITE_ALCANZADO" }
    },
    {
      error: new Anthropic.OverloadedError(
        529, { type: "overloaded_error", message: "Overloaded" }, "Overloaded", new Headers()
      ),
      status: 503,
      body: { error: "IA_NO_DISPONIBLE" }
    }
  ];
  const note = await prisma.nota.create({
    data: { titulo: "Nota para fallar", contenido: "Texto.", usuarioId: null }
  });

  for (const { error, status, body } of cases) {
    const failingApp = createApp({
      db: prisma,
      iaLimit: 5,
      streamAI: async function* () {
        throw error;
      }
    });
    const response = await request(failingApp).post(`/api/notas/${note.id}/resumen`);
    assert.equal(response.status, status);
    assert.deepEqual(response.body, body);
  }
  await prisma.nota.delete({ where: { id: note.id } });
});

test("documenta endpoints del laboratorio en Swagger", async () => {
  const ui = await request(app).get("/api-docs/");
  assert.equal(ui.status, 200);
  const spec = await request(app).get("/api-docs.json");
  assert.equal(spec.status, 200);
  for (const path of [
    "/api/notas",
    "/api/notas/{id}",
    "/api/notas/{id}/resumen",
    "/api/ia/preguntar"
  ]) {
    assert.ok(spec.body.paths[path], `Swagger no documenta ${path}`);
  }
});
