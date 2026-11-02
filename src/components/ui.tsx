"use client";

import { RotateCcw } from "lucide-react";
import { Mascot } from "@/components/mascot";

export function Loading() { return <div className="center-state"><span className="loading-dot"/><p>Miu đang chuẩn bị bài cho ní...</p></div>; }
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) { return <div className="center-state"><Mascot size={120}/><h2>Chưa tải được nội dung</h2><p>{message}</p>{retry && <button className="button button-primary" onClick={retry}><RotateCcw size={17}/> Thử lại</button>}</div>; }
export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) { return <div className="center-state empty-state"><Mascot size={160}/><h2>{title}</h2><p>{detail}</p>{action}</div>; }
export function PageTitle({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) { return <div className="page-title-row"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>; }
