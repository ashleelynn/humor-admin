// Server-only: reads ANTHROPIC_API_KEY. Never import this from a client component.
import Anthropic from "@anthropic-ai/sdk";
import { MOODS, isMood, MAX_LENGTH, type MoodId } from "./confessions";
import { CAPTIONS_PER_DROP } from "./photo-booth";

const DEFAULT_MODEL = "claude-opus-5-5";

// Errors with a message that's safe to show the person who dropped the photo.
export class BoothAIError extends Error {}

// Exactly CAPTIONS_PER_DROP captions is asked for in the prompt and checked below;
// structured outputs don't enforce array lengths.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    alt: { type: "string" },
    captions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          mood: { type: "string", enum: MOODS.map((m) => m.id) },
          text: { type: "string" },
        },
        required: ["mood", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["alt", "captions"],
  additionalProperties: false,
};

type ImageType = "image/jpeg" | "image/png" | "image/webp";

export async function writeCaptions({ image, mimeType, prompt }: { image: ArrayBuffer; mimeType: string; prompt: string }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new BoothAIError("The booth's AI isn't plugged in yet: ANTHROPIC_API_KEY is missing on the server.");
  }
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const client = new Anthropic({ timeout: 55_000, maxRetries: 1 });

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      // If a safety classifier declines, Anthropic retries on its recommended fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: RESPONSE_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mimeType as ImageType, data: Buffer.from(image).toString("base64") },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    });
  } catch (e) {
    if (e instanceof Anthropic.APIConnectionTimeoutError || e instanceof Anthropic.APIConnectionError) {
      console.error("Claude request failed", e);
      throw new BoothAIError("The booth's AI took too long. Try again in a moment.");
    }
    if (e instanceof Anthropic.RateLimitError) {
      throw new BoothAIError("The booth's AI is catching its breath. Try again in a minute.");
    }
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      throw new BoothAIError("Claude turned the request down. Check ANTHROPIC_API_KEY.");
    }
    if (e instanceof Anthropic.BadRequestError || e instanceof Anthropic.NotFoundError) {
      console.error(`Claude ${model} rejected the request`, e);
      throw new BoothAIError(`Claude turned the request down (${e.status}). Check ANTHROPIC_MODEL.`);
    }
    if (e instanceof Anthropic.APIError) {
      console.error(`Claude ${model} answered ${e.status}`, e);
      throw new BoothAIError(`Claude is having a moment (${e.status}). Try again.`);
    }
    throw e;
  }

  if (response.stop_reason === "refusal") {
    throw new BoothAIError("The booth won't caption that one. Try a different photo.");
  }

  const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")?.text ?? "";
  let parsed: { alt?: string; captions?: { mood?: string; text?: string }[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error("Claude sent back something that isn't JSON", response.stop_reason, text);
    throw new BoothAIError("The booth's AI mumbled. Try again.");
  }

  const captions = (parsed.captions ?? [])
    .map((c) => ({ mood: c.mood ?? "", body: (c.text ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_LENGTH) }))
    .filter((c): c is { mood: MoodId; body: string } => isMood(c.mood) && c.body.length > 0)
    .slice(0, CAPTIONS_PER_DROP);
  if (captions.length < CAPTIONS_PER_DROP) {
    console.error("Claude returned too few usable captions", text);
    throw new BoothAIError("The booth's AI mumbled. Try again.");
  }

  const altText = (parsed.alt ?? "").replace(/\s+/g, " ").trim().slice(0, 300) || null;
  // response.model is whichever model actually answered, including a fallback.
  return { model: response.model, altText, captions };
}
