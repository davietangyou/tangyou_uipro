import { parseHbA1cPhotoResult } from "../../shared/hba1cPhoto";
import { recognizePhoto } from "./photoRecognition";
export const recognizeHbA1cPhoto = (photo: Blob, signal: AbortSignal) =>
  recognizePhoto(
    photo,
    signal,
    "/api/ai/hba1c/recognize",
    parseHbA1cPhotoResult,
  );
