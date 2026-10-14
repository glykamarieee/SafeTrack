// Philippine calendar dates as `YYYY-MM-DD` keys.

export function todayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "01";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function fromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(Date.UTC(year!, month! - 1, day!, 12));
}

function toKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function moveDate(value: string, days: number) {
  const date = fromKey(value);
  date.setUTCDate(date.getUTCDate() + days);

  return toKey(date);
}

export function dateLabel(value: string, today: string) {
  if (value === today) return "Today";
  if (value === moveDate(today, -1)) return "Yesterday";

  return fromKey(value).toLocaleDateString("en-PH", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** First and last day of the month containing `value`, plus the grid's leading blanks. */
export function monthGrid(value: string) {
  const date = fromKey(value);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1, 12));
  const last = new Date(Date.UTC(year, month + 1, 0, 12));

  return {
    title: first.toLocaleDateString("en-PH", { timeZone: "UTC", month: "long", year: "numeric" }),
    firstKey: toKey(first),
    lastKey: toKey(last),
    leading: first.getUTCDay(),
    days: Array.from({ length: last.getUTCDate() }, (_, index) => toKey(new Date(Date.UTC(year, month, index + 1, 12)))),
  };
}

export function shiftMonth(value: string, months: number) {
  const date = fromKey(value);

  return toKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1, 12)));
}

export function durationLabel(minutes: number, compact = false) {
  if (minutes < 1) return compact ? "0m" : "0 min";
  if (minutes < 60) return compact ? `${Math.round(minutes)}m` : `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);

  if (compact) return rest ? `${hours}h ${rest}m` : `${hours}h`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function distanceLabel(meters: number) {
  if (!meters) return "0 m";
  if (meters < 1000) return `${Math.round(meters)} m`;

  return `${(meters / 1000).toFixed(1)} km`;
}
