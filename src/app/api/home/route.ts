import { requireViewer } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { active, Attempt, Card, Lesson, Question, Topic } from "@/lib/models";

export const runtime = "nodejs";
export async function GET() {
  try {
    const user = await requireViewer();
    const store = db();
    const [topicsSnap, cardsSnap, lessonsSnap, questionsSnap, progressSnap, attemptsSnap] = await Promise.all([
      store.collection("vocabTopics").get(), store.collection("vocabCards").get(), store.collection("grammarLessons").get(),
      store.collection("grammarQuestions").get(), store.collection("cardProgress").where("uid", "==", user.uid).get(),
      store.collection("quizAttempts").where("uid", "==", user.uid).get(),
    ]);
    const cards = cardsSnap.docs.map(d => ({ id: d.id, ...d.data() as Card })).filter(active);
    const progress = new Map(progressSnap.docs.map(d => [d.data().cardId as string, d.data().status as string]));
    const attempts = attemptsSnap.docs.map(d => ({ id: d.id, ...d.data() as Attempt })).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    const topics = topicsSnap.docs.map(d => ({ id: d.id, ...d.data() as Topic })).filter(active).map(t => {
      const ownCards = cards.filter(c => c.topicId === t.id);
      return { ...t, total: ownCards.length, remembered: ownCards.filter(c => progress.get(c.id) === "remembered").length, toReview: ownCards.filter(c => progress.get(c.id) === "review").length };
    });
    const questions = questionsSnap.docs.map(d => ({ id: d.id, ...d.data() as Question })).filter(active);
    const lessons = lessonsSnap.docs.map(d => ({ id: d.id, ...d.data() as Lesson })).filter(active).map(l => {
      const ownAttempts = attempts.filter(a => a.lessonId === l.id);
      return { id: l.id, title: l.title, total: questions.filter(q => q.lessonId === l.id).length, lastAttempt: ownAttempts[0] ? { id: ownAttempts[0].id, status: ownAttempts[0].status, correct: ownAttempts[0].correctCount, answered: ownAttempts[0].answeredCount } : null };
    });
    return Response.json({ topics, lessons, attempts: attempts.map(a => ({ id: a.id, lessonId: a.lessonId, correct: a.correctCount, answered: a.answeredCount, total: a.questionIds.length, status: a.status, startedAt: a.startedAt })) });
  } catch (error) { return jsonError(error); }
}
