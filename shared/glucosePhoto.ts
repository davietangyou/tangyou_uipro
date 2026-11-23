export type GlucosePhotoUnit = "mmol/L" | "mg/dL";
export type GlucosePhotoResult = {
  status: "reading" | "unreadable" | "ambiguous" | "nonNumeric";
  reading: string | null;
  unit: GlucosePhotoUnit | null;
};
export function parseGlucosePhotoResult(raw: unknown): GlucosePhotoResult {
  const r = raw as Partial<GlucosePhotoResult> | null;
  if (
    !r ||
    !["reading", "unreadable", "ambiguous", "nonNumeric"].includes(
      r.status || "",
    ) ||
    (r.unit !== null && r.unit !== "mmol/L" && r.unit !== "mg/dL")
  )
    throw new Error("Invalid glucose photo result");
  if (r.status === "reading") {
    if (
      typeof r.reading !== "string" ||
      !/^\d{1,4}(\.\d{1,2})?$/.test(r.reading) ||
      Number(r.reading) <= 0
    )
      throw new Error("Invalid glucose reading");
  } else if (r.status === "nonNumeric") {
    if (r.reading !== "HI" && r.reading !== "LO")
      throw new Error("Invalid nonnumeric reading");
  } else if (r.reading !== null)
    throw new Error("Uncertain reading must be empty");
  return { status: r.status!, reading: r.reading!, unit: r.unit };
}
export function confirmedGlucoseValue(
  result: GlucosePhotoResult,
  unit: GlucosePhotoUnit | "",
): number | null {
  if (result.status !== "reading" || !result.reading || !unit) return null;
  const value = Number(result.reading) / (unit === "mg/dL" ? 18 : 1);
  const rounded = Math.round(value * 10) / 10;
  return Number.isFinite(rounded) && rounded > 0 ? rounded : null;
}

// The record UI accepts only the displayed unit; legacy conversion stays available.
export function confirmedRecordGlucoseValue(result: GlucosePhotoResult): number | null {
  return result.unit === "mmol/L" ? confirmedGlucoseValue(result, "mmol/L") : null;
}
