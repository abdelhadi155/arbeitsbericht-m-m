import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import { IMPROVE_TEXT_SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { MAX_IMPROVE_TEXT_LENGTH } from "@/lib/ai/text-improver";

export const runtime = "nodejs";

const MODEL = "claude-opus-5-5";

/**
 * POST { text } → { text }
 * Ohne ANTHROPIC_API_KEY antwortet die Route mit 503, die App bleibt voll nutzbar.
 */
export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Die KI-Textverbesserung ist noch nicht eingerichtet (ANTHROPIC_API_KEY fehlt)." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Bitte zuerst einen Text eingeben." }, { status: 400 });
  }
  if (text.length > MAX_IMPROVE_TEXT_LENGTH) {
    return NextResponse.json({ error: "Der Text ist zu lang." }, { status: 413 });
  }

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low" },
      // Lehnt das Modell ab, beantwortet der Server die Anfrage automatisch mit einem passenden Ersatzmodell.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: IMPROVE_TEXT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Notiz:\n${text}` }],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "Der Text konnte nicht verbessert werden." }, { status: 422 });
    }
    const improved = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();
    if (!improved) {
      return NextResponse.json({ error: "Der Text konnte nicht verbessert werden." }, { status: 502 });
    }
    return NextResponse.json({ text: improved });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "KI-Zugang ungültig – bitte API-Schlüssel prüfen." }, { status: 503 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Zu viele Anfragen – bitte gleich noch einmal versuchen." }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      console.error("Text verbessern fehlgeschlagen", error.status, error.message);
    } else {
      console.error("Text verbessern fehlgeschlagen", error);
    }
    return NextResponse.json({ error: "Der Text konnte nicht verbessert werden." }, { status: 502 });
  }
}
