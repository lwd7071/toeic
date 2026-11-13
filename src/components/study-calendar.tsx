"use client";

import { ChevronLeft, ChevronRight, Flame } from "lucide-react";

export type StudyCalendarData = { today: string; startDate: string; month: string; days: string[]; streak: number; studiedToday?: boolean };

export function shiftMonth(month: string, offset: number): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

export function StudyCalendar({ data, onMonthChange }: { data: StudyCalendarData; onMonthChange: (month: string) => void }) {
  const first = new Date(`${data.month}-01T00:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const learned = new Set(data.days);
  const label = new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  return <section className="paper-panel study-calendar" aria-label={`Lịch học ${label}`}>
    <div className="study-calendar-head"><h2>Lịch học · {label}</h2><div className="study-calendar-nav"><button type="button" aria-label="Tháng trước" onClick={() => onMonthChange(shiftMonth(data.month, -1))}><ChevronLeft size={19}/></button><button type="button" aria-label="Tháng sau" disabled={data.month >= data.today.slice(0, 7)} onClick={() => onMonthChange(shiftMonth(data.month, 1))}><ChevronRight size={19}/></button></div></div>
    <div className="study-calendar-grid">{["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map(day => <strong className="study-weekday" key={day}>{day}</strong>)}{Array.from({ length: offset }, (_, index) => <span key={`empty-${index}`}/>)}{Array.from({ length: count }, (_, index) => {
      const date = `${data.month}-${String(index + 1).padStart(2, "0")}`;
      const state = date < data.startDate ? "untracked" : date > data.today ? "future" : learned.has(date) ? "learned" : "missed";
      const text = state === "learned" ? "Đã học" : state === "missed" ? "Chưa học" : state === "untracked" ? "Chưa theo dõi" : "Chưa tới";
      return <div className={`study-day ${state} ${date === data.today ? "today" : ""}`} key={date} aria-label={`${index + 1}/${Number(data.month.slice(5))}: ${text}`} title={text}><span>{index + 1}</span>{state === "learned" && <Flame size={18} fill="currentColor" aria-hidden="true"/>}</div>;
    })}</div><p className="study-calendar-legend"><Flame size={16} fill="currentColor"/> Có 🔥 khi hoàn thành bài hoặc đánh dấu ít nhất một thẻ từ trong ngày.</p>
  </section>;
}
