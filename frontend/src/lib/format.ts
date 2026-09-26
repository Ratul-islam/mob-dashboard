const intFormat = new Intl.NumberFormat("en-US");
const compactFormat = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export const formatInt = (n: number | null | undefined) => (n == null ? "–" : intFormat.format(n));
export const formatCompact = (n: number) => (Math.abs(n) >= 10_000 ? compactFormat.format(n) : intFormat.format(n));

export const formatPct = (part: number, whole: number, digits = 1) =>
  whole > 0 ? `${((part / whole) * 100).toFixed(digits)}%` : "–";

export const formatCell = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "–";
  if (typeof value === "number") return Number.isInteger(value) ? intFormat.format(value) : value.toFixed(2);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};

/** Timestamps are UTC; show them as UTC so they line up with Anura's reporting days. */
export const formatUtc = (iso: string | null | undefined, withSeconds = false) => {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const date = d.toISOString().slice(0, 10);
  const time = d.toISOString().slice(11, withSeconds ? 19 : 16);
  return `${date} ${time}`;
};

export const formatRelative = (date: Date | number | string | null) => {
  if (!date) return "never";
  const seconds = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

export const formatAnuraDate = (n: number | string | null | undefined) => {
  if (!n) return "–";
  const s = String(n);
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s;
};

/** "rule_sets" -> "Rule sets" */
export const humanizeColumn = (key: string) => {
  const special: Record<string, string> = {
    os_name: "OS",
    os_version: "OS version",
    app_id: "App ID",
    device_id: "Device ID",
    user_agent: "User agent",
    remote_address: "IP address",
    requesting_remote_address: "Requesting IP",
    requesting_user_agent: "Requesting user agent",
  };
  if (special[key]) return special[key];
  const words = key.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};
