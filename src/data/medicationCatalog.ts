import { HK_HA_MEDICATION_GROUPS } from "./hkMedicationGroups";
const extras = [
  ["氨氯地平 Amlodipine", "Amlodipine"],
  ["洛沙坦 Losartan", "Losartan"],
  ["賴諾普利 Lisinopril", "Lisinopril"],
  ["阿托伐他汀 Atorvastatin", "Atorvastatin"],
  ["瑞舒伐他汀 Rosuvastatin", "Rosuvastatin"],
];
const legacyNames: Record<string, string[]> = {
  Metformin: ["二甲雙胍 Metformin"],
  Gliclazide: ["格列齊特 Gliclazide"],
  Glimepiride: ["格列美脲 Glimepiride"],
  Sitagliptin: ["西格列汀 Sitagliptin"],
  Linagliptin: ["利拉利汀 Linagliptin"],
  Empagliflozin: ["恩格列淨 Empagliflozin"],
  Dapagliflozin: ["達格列淨 Dapagliflozin"],
  Pioglitazone: ["吡格列酮 Pioglitazone"],
  Acarbose: ["阿卡波糖 Acarbose"],
  Semaglutide: ["司美格魯肽 Semaglutide"],
  Dulaglutide: ["度拉糖肽 Dulaglutide"],
};
function englishLabel(label: string) {
  return label
    .replace(/\s*[（(]([^()（）]*)[)）]/g, (_, contents: string) => {
      const english = contents.replace(/[\u3400-\u9fff]+/g, "").trim();
      return /[a-z]/i.test(english) ? ` (${english})` : "";
    })
    .trim();
}
// English labels are independent of user-entered names; aliases never migrate stored data.
export const medicationCatalog = [
  ...HK_HA_MEDICATION_GROUPS.flatMap((group) =>
    group.meds.map((m) => ({
      label: englishLabel(m.label),
      aliases: [m.label, m.name, ...(legacyNames[m.name.split(" (")[0]] || [])],
    })),
  ),
  ...extras.map(([alias, label]) => ({ label, aliases: [alias] })),
];
export function medicationCatalogIndex(name: string): number {
  return medicationCatalog.findIndex(
    (entry) => entry.label === name || entry.aliases.includes(name),
  );
}
export function medicationCandidateValue(
  original: string,
  index: number,
): string {
  return original && medicationCatalogIndex(original) === index
    ? original
    : medicationCatalog[index]?.label || "";
}