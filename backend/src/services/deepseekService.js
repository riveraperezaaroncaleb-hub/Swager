import { AppError } from "../utils/AppError.js";

const API_URL = "https://api.deepseek.com/chat/completions";

export async function* streamDeepSeek(messages, { signal } = {}) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new AppError("Configura DEEPSEEK_API_KEY en backend/.env.", 503);
  }

  let response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(60000)])
        : AbortSignal.timeout(60000),
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-flash",
        messages,
        stream: true,
        stream_options: { include_usage: true }
      })
    });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw new AppError("DeepSeek tardó demasiado en responder. Inténtalo de nuevo.", 504);
    }
    throw new AppError("No fue posible conectar con DeepSeek.", 502);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new AppError("DeepSeek rechazó la clave API. Verifica DEEPSEEK_API_KEY.", 502);
    }
    if (response.status === 429) {
      throw new AppError("DeepSeek alcanzó el límite de solicitudes. Inténtalo más tarde.", 503);
    }
    throw new AppError("DeepSeek no pudo procesar la solicitud.", 502);
  }
  if (!response.body) throw new AppError("DeepSeek no habilitó el flujo de respuesta.", 502);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let usage = { inputTokens: 0, outputTokens: 0 };
  let model = process.env.DEEPSEEK_MODEL || "deepseek-flash";

  const parseEvent = (event) => {
    const data = event
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    if (!data || data === "[DONE]") return null;

    let chunk;
    try {
      chunk = JSON.parse(data);
    } catch {
      throw new AppError("DeepSeek envió un bloque de datos inválido.", 502);
    }
    if (chunk.error) throw new AppError("DeepSeek no pudo procesar la solicitud.", 502);

    if (chunk.model) model = chunk.model;
    if (chunk.usage) {
      usage = {
        inputTokens: chunk.usage.prompt_tokens ?? 0,
        outputTokens: chunk.usage.completion_tokens ?? 0
      };
    }
    const text = chunk.choices?.[0]?.delta?.content;
    return typeof text === "string" && text ? { type: "delta", text } : null;
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || "";

      for (const event of events) {
        const parsed = parseEvent(event);
        if (parsed) yield parsed;
      }
      if (done) break;
    }

    if (buffer.trim()) {
      const parsed = parseEvent(buffer);
      if (parsed) yield parsed;
    }
    yield { type: "done", usage, model };
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error.name === "AbortError") throw error;
    throw new AppError("Se interrumpió la respuesta en streaming de DeepSeek.", 502);
  } finally {
    reader.releaseLock();
  }
}
