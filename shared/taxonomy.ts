/**
 * Scenario classification, route-node matching, and value-clarification
 * judgement — pure functions + pure data, no side effects.
 *
 * All keyword lists are sourced from the authoritative core business-logic
 * document set and must not be abbreviated.
 */

// ── Scenario enum ───────────────────────────────────────────────────────────

export type Scenario =
  | 'hba1c_interpretation'
  | 'hypoglycemia'
  | 'diet_management_questions'
  | 'medication_side_effect_adherence'
  | 'decision_support_preference'
  | 'general_fallback'
  | 'dka_hhs_foot_escalation';

// ── Scenario keywords ───────────────────────────────────────────────────────

const SCENARIO_KEYWORDS: Record<Scenario, readonly string[]> = {
  decision_support_preference: [
    '要不要打針', '應唔應該打針', '唔知要唔要打針', '唔知要不要打針',
    '唔想打針', '驚打針', '怕打針', '怕痛', '打唔打針',
    '要不要打胰島素', '應唔應該打胰島素', '打胰島素', 'insulin',
    '控糖針', '排糖針', '轉針', '換針',
    'cgm', '連續血糖儀', '動態血糖', '無痛血糖',
    '要唔要買cgm', '要不要選cgm', '篤手指定cgm', '感應器',
    '要不要換藥', '應唔應該換藥', '加藥定打針', '換藥定打針',
    '點揀好', '點選擇', '點決定', '好矛盾', '唔知點揀',
  ],
  hba1c_interpretation: [
    '糖化', 'hba1c', '指標', '報告', '數值', 'a1c',
    '血糖值', '空腹血糖', '餐後血糖', '量血糖',
  ],
  hypoglycemia: [
    '低血糖', '血糖太低', '頭暈', '冒汗', '手震', '心悸', '出汗',
  ],
  diet_management_questions: [
    '水果', '生果', '果汁', '份量', '主食', '飲茶', '茶樓',
    '出街食飯', '餐廳', '外賣', '食乜', '飯', '粥', '麵',
    '麵包', '戒口', '戒甜', '零食',
  ],
  medication_side_effect_adherence: [
    '藥', '丸', '針', '打針', '注射', '食藥', '停藥', '減藥', '加藥',
    '忘記食藥', '副作用', '傷身', '忘記', '唔記得', '麻煩', '依從性',
    '二甲雙胍', '美福明', 'metformin', '胰島素', 'insulin',
    '格列', '淨', '糖', '控糖',
    '利拉魯肽', '司美格魯肽', '安達唐', '達格列淨', '恩格列淨', '捷諾維',
  ],
  general_fallback: [],
  dka_hhs_foot_escalation: [],
};

// ── Classify (Top-2) ────────────────────────────────────────────────────────

export function classifyScenario(message: string): Scenario[] {
  const lower = message.toLowerCase();
  const scores: [Scenario, number][] = [];

  for (const [scenario, keywords] of Object.entries(SCENARIO_KEYWORDS) as [Scenario, readonly string[]][]) {
    if (!keywords.length) continue;
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score++;
    }
    if (score > 0) scores.push([scenario, score]);
  }

  if (!scores.length) return ['general_fallback'];

  scores.sort((a, b) => b[1] - a[1]);
  return scores.slice(0, 2).map(s => s[0]);
}

// ── Route-node configuration ────────────────────────────────────────────────

export interface RouteNode {
  nodeId: string;
  scenarios: Scenario[];
  risk: 'Low' | 'Moderate' | 'High';
  preferredSourceOrder: string[];
  doNotAnswerDirectly: string[];
}

export const FULL_ROUTING_CONFIG: readonly RouteNode[] = [
  {
    nodeId: 'DM-PREF-1',
    scenarios: ['decision_support_preference'],
    risk: 'Moderate',
    preferredSourceOrder: ['INSULIN-HK', 'MONITOR-PRO', 'ADA-13', 'HK-HB'],
    doNotAnswerDirectly: ['不強行替患者做決定', '不擅自更改處方'],
  },
  {
    nodeId: 'DM-1-3-4',
    scenarios: ['hba1c_interpretation'],
    risk: 'Low',
    preferredSourceOrder: ['ADA-6', 'HK-HB'],
    doNotAnswerDirectly: ['不作個人化治療判斷', '不直接建議改藥'],
  },
  {
    nodeId: 'DM-4-1-3',
    scenarios: ['hba1c_interpretation'],
    risk: 'Low',
    preferredSourceOrder: ['FLUCTUATE-HK', 'HK-HB', 'ADA-6'],
    doNotAnswerDirectly: ['不作個人化目標判定'],
  },
  {
    nodeId: 'DM-6-2-3-4',
    scenarios: ['hba1c_interpretation'],
    risk: 'Low',
    preferredSourceOrder: ['HK-HB', 'ADA-6'],
    doNotAnswerDirectly: ['不作個人化醫療建議'],
  },
  {
    nodeId: 'DM-3-1-1',
    scenarios: ['hypoglycemia'],
    risk: 'High',
    preferredSourceOrder: ['ADA-6', 'HA-DIET', 'HK-HB'],
    doNotAnswerDirectly: ['個人化急救判斷', '藥量調整', '自行停藥'],
  },
  {
    nodeId: 'DM-4-3-1',
    scenarios: ['diet_management_questions'],
    risk: 'Low',
    preferredSourceOrder: ['HA-DIET', 'ADA-5', 'HK-HB'],
    doNotAnswerDirectly: ['不提供個人化餐單', '不提供精準熱量處方'],
  },
  {
    nodeId: 'DM-4-3-3',
    scenarios: ['diet_management_questions'],
    risk: 'Low',
    preferredSourceOrder: ['OUTSIDE-HK', 'HA-DIET', 'ADA-5'],
    doNotAnswerDirectly: ['不提供個人化餐單', '不對特殊共病作精細營養處方'],
  },
  {
    nodeId: 'DM-2-2-4',
    scenarios: ['medication_side_effect_adherence'],
    risk: 'Moderate',
    preferredSourceOrder: ['ADA-13', 'ADA-5', 'HK-HB'],
    doNotAnswerDirectly: ['改藥', '停藥', '換藥', '劑量調整', '判定某副作用一定由某藥造成'],
  },
  {
    nodeId: 'DM-2-2-8',
    scenarios: ['medication_side_effect_adherence'],
    risk: 'Moderate',
    preferredSourceOrder: ['INSULIN-HK', 'TCM-HK', 'ADA-13', 'HK-HB'],
    doNotAnswerDirectly: ['停藥建議', '自行加減藥', '責備式語言'],
  },
  {
    nodeId: 'DM-5-1-1',
    scenarios: ['general_fallback'],
    risk: 'Low',
    preferredSourceOrder: ['MONITOR-PRO', 'ADA-6'],
    doNotAnswerDirectly: ['不建議完全停止監測'],
  },
];

// ── Route matching ──────────────────────────────────────────────────────────

export interface MatchedRoute {
  preferredSourceOrder: string[];
  doNotAnswerDirectly: string[];
}

export function matchRouteNodes(scenarios: Scenario[]): MatchedRoute {
  const matched = FULL_ROUTING_CONFIG.filter(node =>
    node.scenarios.some(s => scenarios.includes(s)),
  );

  const sourceOrder: string[] = [];
  const doNot: string[] = [];

  for (const node of matched) {
    for (const src of node.preferredSourceOrder) {
      if (!sourceOrder.includes(src)) sourceOrder.push(src);
    }
    for (const item of node.doNotAnswerDirectly) {
      if (!doNot.includes(item)) doNot.push(item);
    }
  }

  return { preferredSourceOrder: sourceOrder, doNotAnswerDirectly: doNot };
}

// ── Value-clarification judgement ───────────────────────────────────────────

const DIET_TRADEOFF_WORDS: readonly string[] = [
  '但係', '好難', '唔想', '點算', '又想又怕', '唔想掃興',
  '煩', '想食', '矛盾', '戒唔到', '控制唔到', '好難揀',
  '唔好意思', '朋友', '家人', '飲茶', '方便', '平衡',
  '點揀', '邊個好', '驚血糖高', '又想', '又唔想', '取捨',
];

const STRONG_DECISION_WORDS: readonly string[] = [
  '要唔要打針', '要不要打針', '應唔應該打針', '唔知打唔打',
  '唔想打針', '驚打針', '怕痛',
  '要不要打胰島素', '應唔應該打胰島素',
  'cgm', '連續血糖儀', '篤手指定',
  '換藥定打針', '點揀好', '應唔應該換',
];

const PREFERENCE_SUBMITTED_FLAG = '我已選擇我的個人偏好';

export function needsValueClarification(
  scenarios: Scenario[],
  message: string,
  history: { role: string; text: string }[] = [],
): boolean {
  // Already submitted preferences → no further clarification needed
  const allTexts = [message, ...history.map(h => h.text)];
  if (allTexts.some(t => t.includes(PREFERENCE_SUBMITTED_FLAG))) return false;

  const lower = message.toLowerCase();

  // Strong decision words override scenario classification
  if (STRONG_DECISION_WORDS.some(w => lower.includes(w))) return true;

  // Per-scenario rules
  for (const scenario of scenarios) {
    if (scenario === 'decision_support_preference') return true;
    if (scenario === 'medication_side_effect_adherence') return true;
    if (scenario === 'diet_management_questions') {
      if (DIET_TRADEOFF_WORDS.some(w => lower.includes(w))) return true;
    }
  }

  return false;
}

/** Detect whether the user's latest message (or history) contains the preference-submitted flag. */
export function detectPreferenceSubmitted(
  message: string,
  history: { role: string; text: string }[],
): boolean {
  return message.includes(PREFERENCE_SUBMITTED_FLAG) ||
    history.some(h => h.text.includes(PREFERENCE_SUBMITTED_FLAG));
}