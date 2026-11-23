export type HbA1cPhotoUnit = "%" | "mmol/mol";
export type HbA1cPhotoResult = {
  status: "reading" | "unreadable" | "ambiguous";
  reading: string | null;
  unit: HbA1cPhotoUnit | null;
};
export function parseHbA1cPhotoResult(raw: unknown): HbA1cPhotoResult {
  const r = raw as Partial<HbA1cPhotoResult> | null;
  if (
    !r ||
    !["reading", "unreadable", "ambiguous"].includes(r.status || "") ||
    ![null, "%", "mmol/mol"].includes(r.unit as HbA1cPhotoUnit | null)
  )
    throw new Error("Invalid HbA1c photo result");
  if (r.status === "reading") {
    if (
      typeof r.reading !== "string" ||
      !/^\d{1,4}(\.\d{1,2})?$/.test(r.reading) ||
      Number(r.reading) <= 0
    )
      throw new Error("Invalid HbA1c reading");
  } else if (r.reading !== null)
    throw new Error("Uncertain HbA1c reading must be empty");
  return { status: r.status!, reading: r.reading!, unit: r.unit! };
}
export function confirmedHbA1cValue(
  result: HbA1cPhotoResult,
  unit: HbA1cPhotoUnit | "",
): string | null {
  if (result.status !== "reading" || !result.reading || !unit) return null;
  // NGSP master equation: https://ngsp.org/ifcc.asp . Never use the glucose /18 conversion.
  const value =
    unit === "mmol/mol"
      ? Number(result.reading) * 0.09148 + 2.152
      : Number(result.reading);
  const rounded = Math.round(value * 10) / 10;
  return rounded > 0 && rounded <= 100 ? rounded.toFixed(1) : null;
}

export function confirmedRecordHbA1cValue(result: HbA1cPhotoResult): string | null {
  return result.unit === "%" ? confirmedHbA1cValue(result, "%") : null;
}
