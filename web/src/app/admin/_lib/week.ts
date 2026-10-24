// 날짜 계산(순수 함수). 날짜는 "YYYY-MM-DD" 문자열로만 다룬다.

export const DOW = ["월", "화", "수", "목", "금", "토", "일"] as const;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== "string" || !ISO.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 월요일 시작 요일 번호(월 0 ... 일 6) */
export function dowIndex(iso: string): number {
  return (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export function weekOf(iso: string): string[] {
  const monday = addDays(iso, -dowIndex(iso));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** "2026-10-24" -> "10/24" */
export function md(iso: string): string {
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
}

/** 발행일로 고를 수 있는 범위(오늘부터 이만큼 뒤까지) */
export const DATE_RANGE_DAYS = 14;
