import { parseChatRequest } from "./ai";
import { parseMedicationPhoto } from "./medicationPhoto";
export function parseChatPhotoRequest(raw: unknown) {
  const input = raw as { image?: unknown };
  return {
    chat: parseChatRequest(raw),
    image: parseMedicationPhoto(input?.image),
  };
}
