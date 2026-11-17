import { ApiError } from "./errors";
import { Card } from "./models";

export type DeckCard = Card & { id: string };
export type VocabDeck = { title: string; archivedAt: string | null; cards: DeckCard[] };

export function assertDeckSize(deck: VocabDeck) {
  // shortcut: JSON size leaves room for Firestore field overhead; split a topic if it reaches this limit.
  if (Buffer.byteLength(JSON.stringify(deck), "utf8") > 900 * 1024) {
    throw new ApiError(400, "Bộ thẻ đã gần giới hạn 1 MiB của Firestore. Hãy chia thành chủ đề khác.");
  }
}
