import {backend} from './backendClient';

export type MemoryEntry = {
  id: string;
  category: 'medication' | 'lifestyle' | 'care_context';
  text: string;
  state: 'pending' | 'confirmed' | 'superseded' | 'expired';
  sourceType: string;
  sourceId: string;
  sourceVersion: number;
  validUntil?: string;
};

export async function listMemories() {
  return (await backend<{items:MemoryEntry[]}>('/ai/memories')).items;
}

export async function confirmMemory(id:string) {
  return backend<{state:'confirmed'|'expired'}>(`/ai/memories/${id}/confirm`,{method:'POST'});
}

export async function deleteMemory(id:string) {
  return backend<void>(`/ai/memories/${id}`,{method:'DELETE'});
}
