export type HomeTopic = { id: string; title: string; total: number; remembered: number; toReview: number };
export type HomeLesson = { id: string; title: string; total: number; lastAttempt: { id: string; status: string; correct: number; answered: number } | null };
export type HomeAttempt = { id: string; lessonId: string; correct: number; answered: number; total: number; status: string; startedAt: string };
export type HomeData = { topics: HomeTopic[]; lessons: HomeLesson[]; attempts: HomeAttempt[] };
