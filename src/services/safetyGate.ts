import type { ChatResult, HealthContext } from '../../shared/ai';

/**
 * Deterministic front-end safety gate — executes before any AI call.
 * Returns a pre-built ChatResult when an acute risk pattern is matched,
 * or null when no risk is detected (normal flow continues).
 *
 * Design choice: prefer false positives over false negatives.
 * "我以前試過頭暈但而家冇事" still triggers the hypoglycemia alert.
 */

// ── Keyword lists (one per detection tier) ──────────────────────────────────

const TIER1_HYPO: readonly string[] = [
  '手震', '出汗', '心悸', '頭暈', '昏', '意識不清', '冒冷汗',
];

const TIER2_DKA_HHS: readonly string[] = [
  '口渴難忍', '多尿', '嘔吐', '呼吸有果味', '意識模糊', '極度疲倦', '肚痛',
];

const TIER3_FOOT: readonly string[] = [
  '傷口不癒合', '紅腫發熱', '潰瘍', '腳痛', '腳趾變黑', '腳部感染',
];

const TIER4_MENTAL: readonly string[] = [
  '自殺', '想死', '唔想做人', '死咗去', '傷害自己', '抑鬱',
  '崩潰', '絕望', '無出口', '情緒好差', '生無可戀', '厭世',
];

const TIER5_VAGUE: readonly string[] = [
  '好唔舒服', '好暈', '想嘔',
];

// ── Fixed response templates ────────────────────────────────────────────────

const RESPONSE_HYPO =
  '⚠️ 偵測到可能嘅緊急低血糖徵狀！請立即食用 15 克糖分（如 3 粒方糖或半罐汽水），15 分鐘後再量血糖。如果徵狀無改善或意識模糊，請立即致電 999 尋求協助。安全第一，暫時唔好依賴 AI 回覆。';

const RESPONSE_DKA =
  '⚠️ 偵測到嚴重高血糖危象（如 DKA 或 HHS）嘅徵象！請立即前往急症室或致電 999 尋求緊急醫療協助。呢種情況需要即時醫院處理，唔好嘗試自行解決。安全第一！';

const RESPONSE_FOOT =
  '⚠️ 偵測到可能嘅足部感染或潰瘍！由於糖尿病病友足部問題惡化得好快，請於 24 小時內儘快前往診所或尋求專業醫護處理。暫時請保持傷口清潔，避免再次受壓，但一定要搵專業醫護處理。';

const RESPONSE_MENTAL =
  '⚠️ 偵測到你嘅情緒可能正處於極大壓力或困擾之中。你並不孤單，有人願意陪伴你。請考慮立即致電以下熱線尋求專業支援：\n\n' +
  '1. 香港撒瑪利亞防止自殺會：2389 2222\n' +
  '2. 生命熱線：2382 0000\n' +
  '3. 醫管局精神科 24小時電話諮詢：2466 7350\n' +
  '4. 社會福利署熱線：2343 2255\n\n' +
  '如果你感到即時生命危險，請立即致電 999。我哋非常關心你嘅安全，請優先尋求專業協助。';

const RESPONSE_HIGH_RISK_VAGUE =
  '⚠️ 由於你有相關風險背景且感到明顯不適，建議你暫停使用 AI，儘快聯繫你的家屬或尋求醫療協助。安全第一！';

// ── Matching logic ──────────────────────────────────────────────────────────

function containsAny(text: string, keywords: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

function buildSafetyResult(reply: string): ChatResult {
  return {
    reply,
    urgency: 'emergency',
    shouldSave: false,
    doctorQuestion: null,
    activeNode: 1,
    briefVersion: { takeHomeMessages: [] },
    detailedVersion: { generalExplanation: '', optionComparison: [], suggestedDiscussionPoints: [] },
    suggestedFollowUps: [],
    preferenceQuestions: [],
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Check user message against five tiers of acute risk detection.
 * Returns a ChatResult with a fixed response template when triggered,
 * or null when no risk pattern is matched.
 */
export function checkSafetyGate(
  message: string,
  health: HealthContext,
): ChatResult | null {
  // Tier 1 — Acute hypoglycemia
  if (containsAny(message, TIER1_HYPO)) {
    return buildSafetyResult(RESPONSE_HYPO);
  }

  // Tier 2 — DKA / HHS
  if (containsAny(message, TIER2_DKA_HHS)) {
    return buildSafetyResult(RESPONSE_DKA);
  }

  // Tier 3 — Foot infection
  if (containsAny(message, TIER3_FOOT)) {
    return buildSafetyResult(RESPONSE_FOOT);
  }

  // Tier 4 — Mental health crisis
  if (containsAny(message, TIER4_MENTAL)) {
    return buildSafetyResult(RESPONSE_MENTAL);
  }

  // Tier 5 — High-risk profile + vague discomfort
  const highRisk =
    health.usesInsulin === 'yes' ||
    !!health.hasHypoUnawareness ||
    !!health.hasHypoHistory;
  if (highRisk && containsAny(message, TIER5_VAGUE)) {
    return buildSafetyResult(RESPONSE_HIGH_RISK_VAGUE);
  }

  return null;
}