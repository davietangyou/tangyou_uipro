/**
 * Symptom clinical pathology grouping, lay descriptions, and clinical notes.
 *
 * All data sourced from the authoritative core business-logic document set
 * 「症状记录与临床病理分组体系」.
 */

// ── Clinical pathology groups ───────────────────────────────────────────────

export type SymptomGroup = 'LOW_BG' | 'HIGH_BG' | 'COMPLICATION' | 'GENERAL';

export const SYMPTOM_GROUP_LABELS: Record<SymptomGroup, string> = {
  LOW_BG: '低血糖警示群',
  HIGH_BG: '高血糖滲透性群',
  COMPLICATION: '神經微血管警示',
  GENERAL: '一般',
};

/** Maps each predefined symptom to its clinical group */
export const SYMPTOM_CLINICAL_CATEGORIES: Record<string, SymptomGroup> = {
  '頭暈': 'LOW_BG',
  '冒冷汗': 'LOW_BG',
  '心悸手震': 'LOW_BG',
  '極度飢餓': 'LOW_BG',
  '口乾口渴': 'HIGH_BG',
  '頻尿': 'HIGH_BG',
  '極度疲倦': 'HIGH_BG',
  '視力模糊': 'COMPLICATION',
  '手腳發麻': 'COMPLICATION',
  '噁心不適': 'GENERAL',
};

/** Get group for a symptom; custom symptoms default to GENERAL */
export function symptomGroup(name: string): SymptomGroup {
  return SYMPTOM_CLINICAL_CATEGORIES[name] || 'GENERAL';
}

// ── Lay descriptions (面向用户的通俗描述) ────────────────────────────────────

export const SYMPTOM_LAY_DESCRIPTIONS: Record<string, string> = {
  '頭暈': '頭重腳輕、看東西天旋地轉',
  '冒冷汗': '全身發冷、手心出冷汗',
  '心悸手震': '手部抖動、雙腳發軟無力，覺得心慌慌、心跳特別快',
  '極度飢餓': '肚子極度餓、心慌想找東西吃',
  '口乾口渴': '口乾舌燥、喝很多水依然口渴',
  '頻尿': '一直想去廁所、排尿次數增多',
  '極度疲倦': '身體好累、整個人無精打采',
  '視力模糊': '看東西不清楚、眼睛矇查查',
  '噁心不適': '胃口不好、肚子脹氣、感到想嘔',
  '手腳發麻': '手指腳趾感覺麻痺、像有螞蟻在爬',
};

// ── Professional clinical notes ─────────────────────────────────────────────

export interface SymptomClinicalDetail {
  clinicalNote: string;
  clinicalConcern: string;
}

export const SYMPTOM_CLINICAL_DETAILS: Record<string, SymptomClinicalDetail> = {
  '冒冷汗': {
    clinicalNote: '交感神經過度興奮信號，好發於餐前、空腹或活動後',
    clinicalConcern: '提示降糖藥物劑量可能偏大、餐食延遲或未及時加餐',
  },
  '心悸手震': {
    clinicalNote: '腎上腺素激增早期低血糖預警信號',
    clinicalConcern: '需即時測量血糖，若<4.0需按15-15原則補糖',
  },
  '頭暈': {
    clinicalNote: '大腦葡萄糖供應不足或血壓波動，注意防跌倒',
    clinicalConcern: '若多發於空腹或起立時，需聯合同步監測血壓與血糖',
  },
  '極度飢餓': {
    clinicalNote: '下丘腦攝食中樞受刺激，常伴隨低血糖早期',
    clinicalConcern: '評估主食攝入量與進餐間隔時間是否規律',
  },
  '口乾口渴': {
    clinicalNote: '血漿滲透壓升高刺激口渴中樞，多在餐後或高血糖時加重',
    clinicalConcern: '提示餐後血糖峰值可能過高或全天血糖控制未達標',
  },
  '頻尿': {
    clinicalNote: '血糖超出腎糖閾引發滲透性利尿',
    clinicalConcern: '關注長者夜尿頻繁帶來的脫水及夜間跌倒風險',
  },
  '極度疲倦': {
    clinicalNote: '細胞葡萄糖利用不良或血糖大幅波動所致',
    clinicalConcern: '需評估全天血糖波動幅度和基礎代謝狀態',
  },
  '視力模糊': {
    clinicalNote: '晶狀體滲透壓急性改變引起屈光不正，或微血管病變',
    clinicalConcern: '建議定期安排散瞳眼底檢查，排除糖尿病視網膜病變',
  },
  '手腳發麻': {
    clinicalNote: '長期高血糖毒性累及周圍神經纖維（對稱性手套襪套樣分佈）',
    clinicalConcern: '提示需進行10g單絲觸覺檢查及音叉震動覺篩查',
  },
  '噁心不適': {
    clinicalNote: '胃腸動力異常、胃輕癱或降糖藥物胃腸道副反應',
    clinicalConcern: '若伴隨血糖極高，需警惕糖尿病酮症酸中毒(DKA)',
  },
};