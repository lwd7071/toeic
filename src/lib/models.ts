export type Topic = { title: string; archivedAt: string | null; createdAt: string };
export type Card = { topicId: string; english: string; vietnamese: string; key: string; archivedAt: string | null; createdAt: string };
export type Lesson = { title: string; theory: string; archivedAt: string | null; createdAt: string };
export type Question = { lessonId: string; question: string; A: string; B: string; C: string; D: string; correctAnswer: "A" | "B" | "C" | "D"; explanation: string; key: string; archivedAt: string | null; createdAt: string };
export type Attempt = { uid: string; lessonId: string; questionIds: string[]; answeredCount: number; correctCount: number; status: "in_progress" | "complete"; startedAt: string; completedAt: string | null };
export type Answer = { attemptId: string; uid: string; questionId: string; selected: "A" | "B" | "C" | "D"; correct: boolean; snapshot: Pick<Question,"question"|"A"|"B"|"C"|"D"|"correctAnswer"|"explanation">; answeredAt: string };

export function active<T extends { archivedAt: string | null }>(x: T): boolean { return !x.archivedAt; }
export function now(): string { return new Date().toISOString(); }
