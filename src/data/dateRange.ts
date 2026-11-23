export function dateRangeError(start: string, end: string): string | null {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!valid(start) || !valid(end)) return "請填寫有效的開始及結束日期。";
  return start > end ? "開始日期不能晚於結束日期。" : null;
}
