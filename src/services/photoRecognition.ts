import { apiPath } from "./apiPath";

export async function preparePhoto(photo: Blob, signal?: AbortSignal) {
  const reportFailure = (reason: string, fields: Record<string, unknown> = {}) => {
    if (import.meta.env?.DEV) console.info(JSON.stringify({
      event: 'client.photo.prepare_failed',
      reason,
      originalBytes: photo.size,
      mimeType: photo.type,
      ...fields,
    }));
  };
  if (signal?.aborted) {
    reportFailure('aborted_before_read');
    throw new DOMException("Cancelled", "AbortError");
  }
  if (!photo.size || photo.size > 15 * 1024 * 1024) {
    reportFailure('invalid_size', { maxBytes: 15 * 1024 * 1024 });
    throw new Error("請選擇 15 MB 以下的照片。");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(photo, { imageOrientation: "from-image" });
  } catch (error) {
    reportFailure('decode_failed', { error: error instanceof Error ? error.message : String(error) });
    throw new Error("未能讀取圖片，請選擇 JPG、PNG 或 WebP 照片。");
  }
  let encoded: string;
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reportFailure('canvas_unavailable');
      throw new Error("未能處理圖片。");
    }
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    encoded = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  } finally {
    bitmap.close();
  }
  if (signal?.aborted) {
    reportFailure('aborted_after_encode');
    throw new DOMException("Cancelled", "AbortError");
  }
  if (encoded.length > 2_800_000) {
    reportFailure('encoded_too_large', { encodedLength: encoded.length, maxEncodedLength: 2_800_000 });
    throw new Error("圖片過大，請裁剪要識別的部分後重試。");
  }

  if (import.meta.env?.DEV) console.info(JSON.stringify({
    event: 'client.photo.prepare',
    originalBytes: photo.size,
    mimeType: photo.type,
    encodedLength: encoded.length,
  }));

  return { mimeType: "image/jpeg" as const, data: encoded };
}
export async function recognizePhoto<T>(
  photo: Blob,
  signal: AbortSignal | undefined,
  path: string,
  parse: (raw: unknown) => T,
): Promise<T> {
  const started = performance.now();
  const body = await preparePhoto(photo, signal);
  const timeout = AbortSignal.timeout(65_000);
  let response: Response;
  try {
    const cloudPath:Record<string,string>={'/api/ai/medications/recognize':'medication','/api/ai/glucose/recognize':'glucose','/api/ai/hba1c/recognize':'hba1c'};
    const resolved=import.meta.env?.VITE_CLOUD_MODE === 'true'&&cloudPath[path]?`/api/v1/ai/photos/${cloudPath[path]}`:apiPath(path);
    response = await fetch(resolved, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(resolved.startsWith("/api/v1/") ? {"X-Session-Scope":"app"} : {}) },
      body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error) {
    if (import.meta.env?.DEV) console.info(JSON.stringify({
      event: 'client.photo.error',
      path,
      aborted: !!signal?.aborted,
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      durationMs: Math.round(performance.now() - started),
    }));
    if (signal?.aborted) throw error;
    throw new Error(
      timeout.aborted
        ? "識別逾時，請再試一次。"
        : "未能連接圖片識別服務，請稍後再試或自行輸入。",
    );
  }
  const result = await response.json().catch(() => null);
  if (import.meta.env?.DEV) console.info(JSON.stringify({
    event: 'client.photo.recognize',
    path,
    status: response.status,
    code: result?.error?.code,
    requestId: response.headers.get('X-Request-ID') ?? undefined,
    durationMs: Math.round(performance.now() - started),
  }));
  if (!response.ok)
    throw new Error(
      result?.error?.message || "圖片識別暫時未能使用，請稍後再試。",
    );
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  try {
    return parse(result);
  } catch (error) {
    if (import.meta.env?.DEV) console.info(JSON.stringify({
      event: 'client.photo.parse_failed',
      path,
      error: error instanceof Error ? error.message : String(error),
    }));
    throw new Error("識別結果不完整，請重新拍攝或自行輸入。");
  }
}