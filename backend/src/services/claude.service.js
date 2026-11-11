import Anthropic from "@anthropic-ai/sdk";
import { AppError } from "../utils/errors.js";

const defaultModel = "claude-haiku-4-5-20251001";

export async function* streamClaude(messages, { signal } = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AppError("IA_NO_DISPONIBLE", 503, "IA_NO_DISPONIBLE");
  }

  const [systemMessage, ...conversation] = messages;
  const client = new Anthropic({ apiKey, maxRetries: 0 });
  const stream = client.messages.stream({
    model: process.env.CLAUDE_MODEL || defaultModel,
    max_tokens: 1024,
    system: systemMessage?.content || "",
    messages: conversation.map(({ role, content }) => ({ role, content }))
  }, { signal });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield { type: "delta", text: event.delta.text };
    }
  }

  const message = await stream.finalMessage();
  yield {
    type: "done",
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens
    },
    model: message.model
  };
}
