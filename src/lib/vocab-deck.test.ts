import { describe, expect, it } from "vitest";
import { assertDeckSize, VocabDeck } from "./vocab-deck";

describe("vocabulary deck size", () => {
  it("accepts a normal 200-card deck and rejects a deck near Firestore's limit", () => {
    const deck: VocabDeck = { title: "Topic", archivedAt: null, cards: Array.from({ length: 200 }, (_, index) => ({
      id: `card-${index}`, topicId: "topic", english: `word ${index}`, vietnamese: `nghĩa ${index}`,
      key: `key-${index}`, archivedAt: null, createdAt: "2026-01-01T00:00:00Z",
    })) };
    expect(() => assertDeckSize(deck)).not.toThrow();
    expect(() => assertDeckSize({ ...deck, cards: [...deck.cards, { ...deck.cards[0], id: "huge", vietnamese: "x".repeat(900 * 1024) }] })).toThrow("giới hạn 1 MiB");
  });
});
