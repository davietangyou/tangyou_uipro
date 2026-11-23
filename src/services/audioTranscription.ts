import { apiPath } from "./apiPath";

export async function transcribeAudio(base64Audio: string, mimeType: string): Promise<string> {
  const response = await fetch(apiPath("/api/ai/transcribe"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: base64Audio, mimeType }),
    signal: AbortSignal.timeout(60_000),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.error?.message || "語音辨識未完成，請再試一次或直接輸入。");
  }
  return typeof result?.text === "string" ? result.text.trim() : "";
}