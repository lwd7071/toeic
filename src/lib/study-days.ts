export function vietnamDate(value: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function previousDate(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

export function currentStreak(days: Iterable<string>, today: string): number {
  const learned = new Set(days);
  let day = learned.has(today) ? today : previousDate(today);
  let streak = 0;
  while (learned.has(day)) {
    streak++;
    day = previousDate(day);
  }
  return streak;
}

export function trackingStartDate(): string {
  const value = process.env.STUDY_TRACKING_START_DATE ?? "2026-11-13";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new Error("STUDY_TRACKING_START_DATE phải có dạng YYYY-MM-DD.");
  }
  return value;
}

export function validMonth(value: string | null, today: string): string {
  const month = value ?? today.slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Tháng không hợp lệ.");
  return month;
}
