/** Read the local clock at opening time without mutating the saved form. */
export function recordTimeDraft(
  saved: { date: string; time: string },
  startAtNow: boolean,
  now = new Date(),
) {
  if (!startAtNow) return { ...saved };
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  };
}
