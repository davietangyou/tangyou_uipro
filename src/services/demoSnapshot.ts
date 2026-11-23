import { migrateConversations } from '../data/chat';
import { migrateHbA1c } from '../data/hba1c';
import { migrateGlucose, migrateProfile } from './storage';

const prefix = 'dia_design_';
const fields = ['profile', 'glucose', 'hba1c', 'conversations', 'setup'] as const;
export function hasDemoData(storage: Storage): boolean {
  return Array.from({ length: storage.length }, (_, i) => storage.key(i)).some(key => key?.startsWith(prefix));
}

/** Initialize only an empty preview namespace; never merge over visitor edits. */
export function installDemoSnapshot(storage: Storage, raw: unknown): boolean {
  if (hasDemoData(storage)) return false;
  const data = raw as Record<string, unknown>;
  if (!data || data.version !== 1 || !data.profile || !Array.isArray(data.glucose) || !Array.isArray(data.hba1c) || !Array.isArray(data.conversations)) return false;
  const values = {
    profile: migrateProfile(data.profile), glucose: migrateGlucose(data.glucose),
    hba1c: migrateHbA1c(data.hba1c), conversations: migrateConversations(data.conversations),
    setup: { step: 4, status: 'complete' },
  };
  const written: string[] = [];
  try {
    for (const field of fields) {
      const key = prefix + field;
      storage.setItem(key, JSON.stringify(values[field]));
      written.push(key);
    }
    return true;
  } catch (error) {
    for (const key of written) storage.removeItem(key);
    throw error;
  }
}

export async function loadClientDemo(): Promise<void> {
  if (!(location.pathname === '/diaguide' || location.pathname.startsWith('/diaguide/'))) return;
  try {
    if (hasDemoData(localStorage)) return;
    const response = await fetch('/diaguide/demo-snapshot.json', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (response.ok) installDemoSnapshot(localStorage, await response.json());
  } catch {
    // The established preview seeds remain available if the optional snapshot fails.
    console.warn('示範互動紀錄暫時未能載入。');
  }
}
