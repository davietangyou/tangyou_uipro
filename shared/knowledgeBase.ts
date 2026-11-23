/**
 * Clinical knowledge base — 13 evidence-based entries from ADA 2026,
 * Hong Kong HA guidelines, and local lifestyle knowledge.
 *
 * Retrieved dynamically by route-node preferred_source_order during
 * each chat request. Top 3 entries are injected into AI context.
 */

export interface KnowledgeEntry {
  id: string;
  content: string;
}

export const KNOWLEDGE_BASE: readonly KnowledgeEntry[] = [
  {
    id: 'ADA-13',
    content: '健康長者 A1C < 7.0–7.5%；中等複雜 < 8.0%；非常複雜避免依賴 A1C。血壓目標 < 130/80 mmHg。建議使用 Statin 預防併發症。',
  },
  {
    id: 'ADA-6',
    content: '飯前血糖目標 4.4–7.2 mmol/L。低血糖定義：< 3.9 mmol/L。15:15 法則：15g 糖分，15分鐘後重測。',
  },
  {
    id: 'ADA-5',
    content: '適量帶氧運動與阻力訓練。飲食應均衡，減少加工食品。體重控制有助改善 A1C。',
  },
  {
    id: 'HK-HB',
    content: '醣質交換法：1 份醣 = 10g 碳水。進食順序：先湯、菜 -> 肉 -> 飯。糖化血色素 6.5% 以下為理想。',
  },
  {
    id: 'HA-DIET',
    content: '酒樓飲茶：選蒸點（蝦餃、燒賣），避炸點。茶餐廳：選通粉、米粉，走甜、少醬料。1平碗飯 = 5 份醣。',
  },
  {
    id: 'CHP-DIET',
    content: '定時定量進食，避免過飽或過飢。選擇高纖維食物（糙米、全麥包）。',
  },
  {
    id: 'EHS-DIET',
    content: '針對長者口腔與消化力調整。少食多餐。確保攝取充足纖維預防便秘。',
  },
  {
    id: 'HA-SMART',
    content: '提供水果換算表：細蘋果 1 個 = 1 份醣。注意隱藏糖分陷阱（如芡汁）。',
  },
  {
    id: 'TCM-HK',
    content: '中藥可作輔助調理，但絕對唔可以自行停咗西藥，因為西藥係直接控制血糖，停咗可能會有急性風險。睇中醫時一定要話比中醫師聽你食緊邊幾種西藥。',
  },
  {
    id: 'INSULIN-HK',
    content: '胰島素唔係毒藥，而係身體原本就有但宜家唔夠用嘅「荷爾蒙」。宜家啲針頭好幼（如 4mm），痛感其實比篤手指仲輕。打針有助減輕胰臟負擔，保護剩餘功能。',
  },
  {
    id: 'MONITOR-PRO',
    content: '如果覺得日日量好煩，可以試下「配對監測」：今日量早餐前後，聽日量午餐前後。咁樣可以睇到邊餐飯對你血糖影響最大，唔洗一日量咁多次。',
  },
  {
    id: 'OUTSIDE-HK',
    content: '酒樓：避開糯米雞、粉果、腸粉（皮太厚）。揀點心時食肉唔好食汁。茶餐廳：避開西多士、米線（升糖快）。揀熱檸茶走甜，唔好飲凍飲（多預設糖）。',
  },
  {
    id: 'FLUCTUATE-HK',
    content: '血糖唔係死數，會跟住你食飯、瞓覺、心情變。朝早高可能係因為「黎明現象」（身體準備起身提供能量），或者尋晚食得唔夠。唔好因為一次半次跳動就驚，最重要睇長期趨勢。',
  },
];

/**
 * Retrieve up to `limit` knowledge entries by their IDs in order.
 * Duplicates are skipped.
 */
export function retrieveKnowledge(
  sourceOrder: string[],
  limit = 3,
): KnowledgeEntry[] {
  const seen = new Set<string>();
  const result: KnowledgeEntry[] = [];
  for (const id of sourceOrder) {
    if (seen.has(id)) continue;
    seen.add(id);
    const entry = KNOWLEDGE_BASE.find(e => e.id === id);
    if (entry) {
      result.push(entry);
      if (result.length >= limit) break;
    }
  }
  return result;
}