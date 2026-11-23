import { AiError } from './ai';
export type MedicationPhoto = { mimeType: 'image/jpeg' | 'image/png' | 'image/webp'; data: string };
export function parseMedicationPhoto(raw: unknown): MedicationPhoto {
  const photo = raw as Partial<MedicationPhoto> | null;
  if (!photo || !['image/jpeg','image/png','image/webp'].includes(photo.mimeType || '') || typeof photo.data !== 'string' || !photo.data.length || photo.data.length > 2_800_000 || photo.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(photo.data))
    throw new AiError('INVALID_PHOTO', '請選擇有效的 JPG、PNG 或 WebP 照片。');
  return { mimeType: photo.mimeType!, data: photo.data };
}
export function parseMedicationPhotoResult(raw: unknown): { names: string[] } {
  const names = (raw as {names?: unknown})?.names;
  if (!Array.isArray(names) || names.length > 10 || names.some(name => typeof name !== 'string' || !name.trim() || name.length > 200))
    throw new Error('Invalid medication photo result');
  return { names: [...new Set(names.map(name => name.trim()).filter(name => /[A-Za-z]/.test(name) && !/[\u3400-\u9fff]/.test(name)))] };
}
