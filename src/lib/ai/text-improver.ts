/**
 * Client-Seite der Funktion „Text verbessern“.
 * Die eigentliche KI-Anfrage läuft serverseitig (app/api/text-verbessern), damit kein
 * API-Schlüssel im Browser landet. Anbieter/Modell lassen sich dort austauschen.
 */
export type ImproveTextResult =
  | { ok: true; text: string }
  | { ok: false; reason: "not_configured" | "offline" | "error"; message: string };

export const MAX_IMPROVE_TEXT_LENGTH = 6000;

export async function improveWorkDescription(text: string): Promise<ImproveTextResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ok: false, reason: "offline", message: "Keine Internetverbindung – Text verbessern ist nur online möglich." };
  }
  try {
    const response = await fetch("/api/text-verbessern", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = (await response.json().catch(() => ({}))) as { text?: string; error?: string };
    if (response.status === 503) {
      return {
        ok: false,
        reason: "not_configured",
        message: data.error ?? "Die KI-Textverbesserung ist noch nicht eingerichtet.",
      };
    }
    if (!response.ok || !data.text) {
      return { ok: false, reason: "error", message: data.error ?? "Der Text konnte nicht verbessert werden." };
    }
    return { ok: true, text: data.text };
  } catch {
    return { ok: false, reason: "error", message: "Der Text konnte nicht verbessert werden." };
  }
}
