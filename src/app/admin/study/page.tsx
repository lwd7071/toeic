"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Flame } from "lucide-react";
import { StudyCalendar } from "@/components/study-calendar";
import { ErrorState, Loading, PageTitle } from "@/components/ui";
import { vietnamDate } from "@/lib/study-days";
import { useLoad } from "@/lib/use-load";
import { Pagination, usePagination } from "@/components/pagination";

type Student = { uid: string; email: string; name: string; startDate: string; days: string[]; streak: number; studiedToday: boolean };
type Data = { today: string; month: string; students: Student[]; nextPageToken: string | null };

export default function AdminStudy() {
  const [month, setMonth] = useState(() => vietnamDate().slice(0, 7));
  const [day, setDay] = useState(() => vietnamDate());
  const pagination = usePagination();
  const [selectedUid, setSelectedUid] = useState("");
  const { data, error, loading, reload } = useLoad<Data>(`/api/admin/study?month=${month}${pagination.token ? `&pageToken=${encodeURIComponent(pagination.token)}` : ""}`);
  if (loading) return <Loading/>;
  if (error || !data) return <ErrorState message={error} retry={reload}/>;
  const selected = data.students.find(student => student.uid === selectedUid) ?? data.students[0];
  function changeMonth(value: string) {
    pagination.reset(); setSelectedUid(""); setMonth(value); setDay(value === vietnamDate().slice(0, 7) ? vietnamDate() : `${value}-01`);
  }
  return <><Link href="/admin" className="back-link"><ArrowLeft size={17}/> Quản trị</Link><PageTitle title="Lịch học viên" description="Một ngày có 🔥 khi học viên hoàn thành bài hoặc đánh dấu một thẻ từ."/>
    <div className="paper-panel admin-study-controls"><label>Ngày cần xem <input className="field" type="date" value={day} max={data.today} onChange={event => { const value = event.target.value; if (value) { if (value.slice(0, 7) !== month) { setMonth(value.slice(0, 7)); pagination.reset(); } setDay(value); } }}/></label><p>Giờ Việt Nam · Đăng nhập mà chưa hoàn thành bài hoặc đánh dấu thẻ vẫn tính là chưa học.</p></div>
    <div className="admin-study-layout"><section><h2>Học viên ({data.students.length}{data.nextPageToken ? "+" : ""})</h2><div className="admin-list">{data.students.map(student => {
      const state = day < student.startDate ? "Chưa theo dõi" : day > data.today ? "Chưa tới" : student.days.includes(day) ? "Đã học 🔥" : "Chưa học";
      return <button type="button" className={`admin-study-person ${selected?.uid === student.uid ? "active" : ""}`} onClick={() => setSelectedUid(student.uid)} key={student.uid}><span><strong>{student.name}</strong><small>{student.email}</small></span><span><b>{state}</b><small><Flame size={14} fill="currentColor"/> {student.streak} ngày</small></span></button>;
    })}</div>{!data.students.length && <p>Trang này chưa có học viên.</p>}<Pagination page={pagination.page} nextPageToken={data.nextPageToken} previous={() => {pagination.previous();setSelectedUid("")}} next={token => {pagination.next(token);setSelectedUid("")}}/></section>
    {selected && <div><div className="study-streak"><Flame size={25} fill="currentColor"/><strong>{selected.streak} ngày liên tiếp</strong><span>{selected.name} · {selected.email}</span></div><StudyCalendar data={{ today: data.today, startDate: selected.startDate, month, days: selected.days, streak: selected.streak }} onMonthChange={changeMonth}/></div>}</div>
  </>;
}
