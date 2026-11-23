import { parseGlucosePhotoResult } from "../../shared/glucosePhoto";
import { recognizePhoto } from "./photoRecognition";
export const recognizeGlucosePhoto = (photo: Blob, signal?: AbortSignal) =>
  recognizePhoto(
    photo,
    signal,
    "/api/ai/glucose/recognize",
    parseGlucosePhotoResult,
  );
