import { parseMedicationPhotoResult } from '../../shared/medicationPhoto';
import { recognizePhoto } from './photoRecognition';
export interface MedicationRecognitionResult { name: string; dosage?: string; usage?: string; }
export interface MedicationRecognitionService {
  available: boolean;
  recognize: (photo: Blob, signal?: AbortSignal) => Promise<MedicationRecognitionResult[]>;
}
export const medicationRecognition: MedicationRecognitionService = {
  available: true,
  async recognize(photo, signal) {
    const result = await recognizePhoto(photo, signal, '/api/ai/medications/recognize', parseMedicationPhotoResult);
    return result.names.map(name => ({name}));
  },
};
