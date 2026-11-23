import type { ChatRequest } from '../../shared/ai';
import type { AppointmentReminder, PendingMemory } from '../../shared/ai';
export type SaveSuggestionState = 'pending' | 'saved' | 'dismissed' | 'collapsed';
export interface ChatMsg {
  id: string; role: 'user' | 'ai'; text: string; timestamp: number;
  tips?: string[]; shouldSave?: boolean; doctorQuestion?: string;
  source?: 'user' | 'gemini' | 'qwen' | 'demo'; suggestionState?: SaveSuggestionState;
  hasPhoto?: boolean; // Metadata only; never persist image bytes or URLs. Missing on legacy messages means text-only.
  delivery?: 'pending' | 'sent' | 'failed'; error?: string;
  appointmentReminder?: AppointmentReminder;
  pendingMemories?: PendingMemory[];
  // Extended fields from 5-Node reasoning pipeline
  activeNode?: number;
  briefVersion?: { takeHomeMessages: string[] };
  detailedVersion?: {
    generalExplanation: string;
    optionComparison: { option: string; pros: string; cons: string }[];
    suggestedDiscussionPoints: string[];
  };
  suggestedFollowUps?: string[];
  preferenceQuestions?: {
    id: string;
    questionText: string;
    options: { valueCategory: string; label: string; description: string }[];
  }[];
}
export interface Conversation { id: string; title: string; messages: ChatMsg[]; createdAt: number; }
export function migrateConversations(raw: unknown): Conversation[] {
  if (!Array.isArray(raw)) throw new Error('對話紀錄格式不正確，原有資料已保留。');
  return raw.map(c => {
    if (!c || typeof c.id !== 'string' || !Array.isArray(c.messages)) throw new Error('對話紀錄格式不正確，原有資料已保留。');
    return { ...c, messages: c.messages.map((m: ChatMsg) => {
      if (!m || typeof m.text !== 'string' || !['user','ai'].includes(m.role)) throw new Error('對話內容未能讀取，原有資料已保留。');
      if (m.hasPhoto !== undefined && typeof m.hasPhoto !== 'boolean') throw new Error('照片訊息標記格式不正確，原有資料已保留。');
      return { ...m, source: m.source || 'demo', ...(m.delivery === 'pending' ? { delivery: 'failed', error: '上次回應未完成，您可以重新嘗試。' } : {}) };
    }) };
  });
}
export function chatHistory(messages: ChatMsg[], currentId: string): ChatRequest['history'] {
  const index = messages.findIndex(m => m.id === currentId);
  return messages.slice(0, index < 0 ? messages.length : index)
    .filter(m => m.source !== 'demo' && m.source && m.delivery !== 'failed' && m.delivery !== 'pending')
    .slice(-20).map(m => ({ role: m.role, text: m.hasPhoto ? `（此則訊息曾附照片，原圖未保留）\n${m.text}` : m.text }));
}