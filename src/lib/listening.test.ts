import { describe, expect, it } from "vitest";
import { driveLink, normalizedTranscript, parseListeningCsv } from "./listening";

describe("listening", () => {
  it("checks Drive file links without accepting another host", () => {
    expect(driveLink("https://drive.google.com/file/d/abcDEF12345/view").mediaUrl).toContain("id=abcDEF12345");
    expect(() => driveLink("https://example.com/file/d/abcDEF12345/view")).toThrow();
  });
  it("ignores punctuation, case and extra spaces in dictation", () => {
    expect(normalizedTranscript("  HELLO,   world! ")).toBe(normalizedTranscript("Hello world."));
    expect(normalizedTranscript("Don't stop.")).toBe(normalizedTranscript("Dont stop"));
    expect(normalizedTranscript("Hello word")).not.toBe(normalizedTranscript("Hello world"));
  });
  it("reports invalid answer and links in picture CSV", () => {
    const csv = "image_url,audio_url,A,B,C,D,correct_answer\nhttps://drive.google.com/file/d/abcDEF12345/view,https://drive.google.com/file/d/xyzABC12345/view,one,two,three,four,E\n";
    const result = parseListeningCsv(Buffer.from(csv), "picture");
    expect(result.count).toBe(0);
    expect(result.errors[0]).toContain("Dòng 2");
  });
  it("parses a dictation row", () => {
    const csv = "audio_url,transcript\nhttps://drive.google.com/file/d/abcDEF12345/view,Hello world.\n";
    expect(parseListeningCsv(Buffer.from(csv), "dictation").rows[0].transcript).toBe("Hello world.");
  });
});
