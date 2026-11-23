import { toHongKongChinese } from './locale';

export type Urgency = 'routine' | 'prompt' | 'emergency';
export interface AppointmentReminder {
  date: string;
  time?: string;
  location?: string;
  daysUntil: number;
}
export interface PendingMemory {
  id: string;
  category: 'medication' | 'lifestyle' | 'care_context';
  text: string;
}
export interface ExtractedProfileData {
  statedConcern?: string | null;
  scenarioTheme?: string | null;
  caregiverMentioned?: boolean | null;
  educationTopic?: string | null;
  preference?: string | null;
  inferredNote?: string | null;
  riskSignal?: string | null;
}
export interface ChatResult {
  provider?: 'qwen' | 'gemini';
  reply: string;
  urgency: Urgency;
  shouldSave: boolean;
  doctorQuestion: string | null;
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
  extractedProfileData?: ExtractedProfileData;
}
export interface OrganizeResult {
  summary: string;
  recommendedQuestions: { sourceIndex: number; categoryTag: string }[];
}
export interface OrganizeRequest {
  questions: string[];
  selectedQuestions: string[];
}
export const normalizeQuestion = (text: string) => text.trim().replace(/\s+/g, ' ');
export const uniqueQuestions = (questions: string[]) => [...new Set(questions.map(normalizeQuestion).filter(Boolean))];
export interface HealthContext {
  source: 'user' | 'demo';
  age: number | null;
  diabetesType: string | null;
  usesInsulin: string;
  conditions: string[];
  medications: { name: string; dosage?: string; usage?: string }[];
  glucose: { value: number | null; timestamp: number; timeType: string; mealTag?: string; symptoms: string[] }[];
  hba1c: { value: string; date: string; time?: string }[];

  // Extended profile fields
  name?: string | null;
  sex?: string | null;
  heightCm?: number | null;
  weight?: number | null;
  weightUnit?: string;
  diabetesDurationYears?: number | null;

  hasHypoHistory?: boolean;
  isFrail?: boolean;
  hasHypoUnawareness?: boolean;
  healthLiteracy?: string | null;

  hasCaregiverSupport?: boolean;
  livesAlone?: boolean;
  dietHabits?: string[];
  favoriteFoods?: string;
  exerciseFreq?: string | null;
  exerciseTypes?: string[];
  exerciseMinutes?: number | null;

  clinicTypes?: string[];

  expressedConcerns?: string[];
  preferenceSignals?: string[];
  educationTopicsViewed?: string[];
  recentQuestionThemes?: string[];
  inferredNotes?: string[];
  riskSignals?: string[];
}
export interface ChatRequest {
  message: string;
  history: { role: 'user' | 'ai'; text: string }[];
  health: HealthContext;
}
export class AiError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
const object = (v: unknown): Record<string, any> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new AiError('INVALID_INPUT', '資料格式不正確。');
  return v as Record<string, any>;
};
function string(v: unknown, max: number, empty = false): string {
  if (typeof v !== 'string' || (!empty && !v.trim()) || v.length > max) throw new AiError('INVALID_INPUT', '文字內容為空或過長，請縮短後再試。');
  return v.trim();
}
function array(v: unknown, max: number): any[] {
  if (!Array.isArray(v) || v.length > max) throw new AiError('INVALID_INPUT', '資料數量超出上限，請減少後再試。');
  return v;
}
function number(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new AiError('INVALID_INPUT', '數值資料不正確。');
  return v;
}
export function parseChatRequest(raw: unknown): ChatRequest {
  const r = object(raw), h = object(r.health);
  if (!['user', 'demo'].includes(h.source)) throw new AiError('INVALID_INPUT', '資料來源不正確。');
  const optional = (v: unknown, max: number) => v === undefined ? undefined : string(v, max, true);
  const optionalStringArray = (v: unknown, max: number, itemMax: number) =>
    v === undefined ? undefined : array(v, max).map(item => string(item, itemMax, true));
  return {
    message: string(r.message, 50_000),
    history: array(r.history, 20).map(v => {
      const t = object(v);
      if (!['user', 'ai'].includes(t.role)) throw new AiError('INVALID_INPUT', '對話角色不正確。');
      return { role: t.role, text: string(t.text, 100_000) };
    }),
    health: {
      source: h.source, age: h.age === null ? null : number(h.age),
      diabetesType: h.diabetesType === null ? null : string(h.diabetesType, 100),
      usesInsulin: string(h.usesInsulin, 20),
      conditions: array(h.conditions, 30).map(v => string(v, 100)),
      medications: array(h.medications, 50).map(v => { const m = object(v); return { name: string(m.name, 200), dosage: optional(m.dosage, 200), usage: optional(m.usage, 300) }; }),
      glucose: array(h.glucose, 100).map(v => { const g = object(v); return { value: g.value === null ? null : number(g.value), timestamp: number(g.timestamp), timeType: string(g.timeType, 30), mealTag: optional(g.mealTag, 30), symptoms: array(g.symptoms, 30).map(s => string(s, 100)) }; }),
      hba1c: array(h.hba1c, 3).map(v => { const g = object(v); return { value: string(g.value, 20), date: string(g.date, 10), time: optional(g.time, 5) }; }),

      // Extended fields — all optional
      name: h.name === undefined ? undefined : (h.name === null ? null : string(h.name, 50, true)),
      sex: h.sex === undefined ? undefined : (h.sex === null ? null : string(h.sex, 20, true)),
      heightCm: h.heightCm === undefined ? undefined : (h.heightCm === null ? null : number(h.heightCm)),
      weight: h.weight === undefined ? undefined : (h.weight === null ? null : number(h.weight)),
      weightUnit: h.weightUnit === undefined ? undefined : string(h.weightUnit, 10, true),
      diabetesDurationYears: h.diabetesDurationYears === undefined ? undefined : (h.diabetesDurationYears === null ? null : number(h.diabetesDurationYears)),

      hasHypoHistory: h.hasHypoHistory === undefined ? undefined : !!h.hasHypoHistory,
      isFrail: h.isFrail === undefined ? undefined : !!h.isFrail,
      hasHypoUnawareness: h.hasHypoUnawareness === undefined ? undefined : !!h.hasHypoUnawareness,
      healthLiteracy: h.healthLiteracy === undefined ? undefined : (h.healthLiteracy === null ? null : string(h.healthLiteracy, 20, true)),

      hasCaregiverSupport: h.hasCaregiverSupport === undefined ? undefined : !!h.hasCaregiverSupport,
      livesAlone: h.livesAlone === undefined ? undefined : !!h.livesAlone,
      dietHabits: h.dietHabits === undefined ? undefined : array(h.dietHabits, 10).map(v => string(v, 100)),
      favoriteFoods: h.favoriteFoods === undefined ? undefined : string(h.favoriteFoods, 500, true),
      exerciseFreq: h.exerciseFreq === undefined ? undefined : (h.exerciseFreq === null ? null : string(h.exerciseFreq, 20, true)),
      exerciseTypes: h.exerciseTypes === undefined ? undefined : array(h.exerciseTypes, 10).map(v => string(v, 50)),
      exerciseMinutes: h.exerciseMinutes === undefined ? undefined : (h.exerciseMinutes === null ? null : number(h.exerciseMinutes)),

      clinicTypes: optionalStringArray(h.clinicTypes, 10, 50),

      expressedConcerns: optionalStringArray(h.expressedConcerns, 50, 200),
      preferenceSignals: optionalStringArray(h.preferenceSignals, 50, 200),
      educationTopicsViewed: optionalStringArray(h.educationTopicsViewed, 50, 200),
      recentQuestionThemes: optionalStringArray(h.recentQuestionThemes, 50, 200),
      inferredNotes: optionalStringArray(h.inferredNotes, 50, 500),
      riskSignals: optionalStringArray(h.riskSignals, 50, 200),
    },
  };
}
export function parseQuestions(raw: unknown): string[] {
  const list = array(object(raw).questions, 200).map(v => string(v, 1000));
  const unique = [...new Set(list.map(v => v.replace(/\s+/g, ' ')))];
  if (!unique.length) throw new AiError('EMPTY_QUESTIONS', '請先儲存一些問題。');
  return unique;
}
export function parseOrganizeRequest(raw: unknown): OrganizeRequest {
  const r = object(raw), questions = parseQuestions(raw);
  const selectedQuestions = uniqueQuestions(array(r.selectedQuestions ?? [], 200).map(v => string(v, 1000)));
  if (selectedQuestions.some(q => !questions.includes(q))) throw new AiError('INVALID_INPUT', '已選問題不在問題列表中，請重新整理。');
  return {questions, selectedQuestions};
}
const hasPlaceholder = (text: string) => /(?:\[|【|<)(?:具體|具体|請填|请填|填寫|填写|藥物名稱|药物名称|藥名|药名|姓名|數值|数值)[^\]】>]*(?:\]|】|>)/.test(text);
export function parseChatResult(raw: unknown): ChatResult {
  const r = object(raw);
  if (!['routine', 'prompt', 'emergency'].includes(r.urgency) || typeof r.shouldSave !== 'boolean') throw new Error('Invalid model routing');
  const reply = toHongKongChinese(string(r.reply, 100_000));
  // A timely-care answer must never be presented as a question that can wait for a routine visit.
  const shouldSave = r.urgency === 'routine' && r.shouldSave;
  const doctorQuestion = shouldSave ? toHongKongChinese(string(r.doctorQuestion, 2_000)) : null;
  if (hasPlaceholder(reply) || (doctorQuestion && hasPlaceholder(doctorQuestion))) throw new Error('Unfilled response placeholder');

  // ── Extended fields (tolerant parsing — default to safe values) ────────

  // activeNode — default 5 (standard output mode)
  const activeNode = typeof r.activeNode === 'number'
    && Number.isInteger(r.activeNode)
    && r.activeNode >= 1 && r.activeNode <= 5
    ? r.activeNode : 5;

  // briefVersion
  let takeHomeMessages: string[] = Array.isArray(r.briefVersion?.takeHomeMessages)
    ? r.briefVersion.takeHomeMessages
        .filter((m: unknown) => typeof m === 'string' && (m as string).trim())
        .slice(0, 5)
        .map((m: string) => toHongKongChinese(m))
    : [];

  // detailedVersion
  const generalExplanation = typeof r.detailedVersion?.generalExplanation === 'string'
    ? toHongKongChinese(r.detailedVersion.generalExplanation) : '';

  let optionComparison: { option: string; pros: string; cons: string }[] = Array.isArray(r.detailedVersion?.optionComparison)
    ? r.detailedVersion.optionComparison
        .filter((o: any) => o && typeof o.option === 'string' && typeof o.pros === 'string' && typeof o.cons === 'string')
        .slice(0, 4)
        .map((o: any) => ({
          option: toHongKongChinese(o.option),
          pros: toHongKongChinese(o.pros),
          cons: toHongKongChinese(o.cons),
        }))
    : [];

  const suggestedDiscussionPoints: string[] = Array.isArray(r.detailedVersion?.suggestedDiscussionPoints)
    ? r.detailedVersion.suggestedDiscussionPoints
        .filter((s: unknown) => typeof s === 'string' && (s as string).trim())
        .slice(0, 5)
        .map((s: string) => toHongKongChinese(s))
    : [];

  // suggestedFollowUps
  const suggestedFollowUps: string[] = Array.isArray(r.suggestedFollowUps)
    ? r.suggestedFollowUps
        .filter((s: unknown) => typeof s === 'string' && (s as string).trim())
        .slice(0, 5)
    : [];

  // preferenceQuestions
  const preferenceQuestions = Array.isArray(r.preferenceQuestions)
    ? r.preferenceQuestions
        .filter((q: any) => q && typeof q.id === 'string' && typeof q.questionText === 'string' && Array.isArray(q.options))
        .slice(0, 4)
        .map((q: any) => ({
          id: q.id as string,
          questionText: q.questionText as string,
          options: Array.isArray(q.options) ? q.options.filter((o: any) =>
            o && typeof o.valueCategory === 'string' && typeof o.label === 'string' && typeof o.description === 'string'
          ).map((o: any) => ({ valueCategory: o.valueCategory, label: o.label, description: o.description })) : [],
        }))
    : [];

  // extractedProfileData — tolerant parsing, skip if absent or malformed
  let extractedProfileData: ExtractedProfileData | undefined;
  if (r.extractedProfileData && typeof r.extractedProfileData === 'object' && !Array.isArray(r.extractedProfileData)) {
    const e = r.extractedProfileData;
    const optStr = (v: unknown): string | null => (typeof v === 'string' && v.trim()) ? v.trim() : null;
    const optBool = (v: unknown): boolean | null => v === true ? true : null;
    const parsed: ExtractedProfileData = {
      statedConcern: optStr(e.statedConcern),
      scenarioTheme: optStr(e.scenarioTheme),
      caregiverMentioned: optBool(e.caregiverMentioned),
      educationTopic: optStr(e.educationTopic),
      preference: optStr(e.preference),
      inferredNote: optStr(e.inferredNote),
      riskSignal: optStr(e.riskSignal),
    };
    // Only include if at least one field has a non-null value
    if (Object.values(parsed).some(v => v !== null)) {
      extractedProfileData = parsed;
    }
  }

  // ── Node 3 deterministic enforcement ──────────────────────────────────
  if (activeNode === 3) {
    takeHomeMessages = [];
    optionComparison = [];
  }

  // ── Existing optional fields ──────────────────────────────────────────
  let appointmentReminder: AppointmentReminder | undefined;
  if (r.appointmentReminder !== undefined) {
    const value = object(r.appointmentReminder), daysUntil = value.daysUntil;
    if (!Number.isInteger(daysUntil) || daysUntil < 0 || daysUntil > 3) throw new Error('Invalid appointment reminder');
    const date = string(value.date, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid appointment reminder date');
    appointmentReminder = {
      date,
      daysUntil,
      ...(value.time === undefined ? {} : {time:string(value.time,5)}),
      ...(value.location === undefined ? {} : {location:toHongKongChinese(string(value.location,2_000))}),
    };
  }
  let pendingMemories: PendingMemory[] | undefined;
  if (r.pendingMemories !== undefined) {
    pendingMemories = array(r.pendingMemories,3).map(value => {
      const memory=object(value), category=memory.category;
      if (!['medication','lifestyle','care_context'].includes(category)) throw new Error('Invalid memory category');
      return {id:string(memory.id,100),category,text:toHongKongChinese(string(memory.text,2_000))} as PendingMemory;
    });
  }
  return { reply, urgency: r.urgency, shouldSave, doctorQuestion,
    ...(['qwen','gemini'].includes(r.provider) ? {provider:r.provider} : {}),
    ...(appointmentReminder ? {appointmentReminder} : {}),
    ...(pendingMemories?.length ? {pendingMemories} : {}),
    // Extended fields
    activeNode,
    briefVersion: { takeHomeMessages },
    detailedVersion: { generalExplanation, optionComparison, suggestedDiscussionPoints },
    suggestedFollowUps,
    preferenceQuestions,
    ...(extractedProfileData ? {extractedProfileData} : {}),
  };
}
export function parseOrganizeResult(raw: unknown, inputCount: number): OrganizeResult {
  const r = object(raw), summary = toHongKongChinese(string(r.summary, 20_000));
  const used = new Set<number>();
  const recommendedQuestions = array(r.recommendedQuestions, Math.min(5, inputCount)).map(v => {
    const q = object(v), index = q.sourceIndex;
    if (!Number.isInteger(index) || index < 0 || index >= inputCount || used.has(index)) throw new Error('Invalid question source');
    used.add(index);
    return { sourceIndex: index as number, categoryTag: toHongKongChinese(string(q.categoryTag, 200)) };
  });
  return { summary, recommendedQuestions };
}