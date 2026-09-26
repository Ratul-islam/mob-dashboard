/** All reporting dates are UTC calendar days in YYYY-MM-DD form. */
export const todayUtc = () => new Date().toISOString().slice(0, 10);

export const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const daysInclusive = (start: string, end: string) =>
  Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;

export type RangePreset = "today" | "yesterday" | "last3" | "last7" | "last30" | "thisMonth" | "lastMonth" | "custom";

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last3", label: "Last 3 days" },
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "thisMonth", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "custom", label: "Custom range" },
];

export const presetRange = (preset: RangePreset, today = todayUtc()) => {
  switch (preset) {
    case "yesterday":
      return { start: addDays(today, -1), end: addDays(today, -1) };
    case "last3":
      return { start: addDays(today, -2), end: today };
    case "last7":
      return { start: addDays(today, -6), end: today };
    case "last30":
      return { start: addDays(today, -29), end: today };
    case "thisMonth":
      return { start: `${today.slice(0, 7)}-01`, end: today };
    case "lastMonth": {
      const lastDay = addDays(`${today.slice(0, 7)}-01`, -1);
      return { start: `${lastDay.slice(0, 7)}-01`, end: lastDay };
    }
    default:
      return { start: today, end: today };
  }
};
