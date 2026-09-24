import { describe, it, expect } from "vitest";
import { defaultBaseUrl, extractJson } from "@/lib/ai";

describe("AI lib pure helpers", () => {
  it("defaultBaseUrl returns a base URL per provider", () => {
    expect(defaultBaseUrl("anthropic")).toBe("https://api.anthropic.com");
    expect(defaultBaseUrl("openai")).toBe("https://api.openai.com/v1");
    expect(defaultBaseUrl("openrouter")).toBe("https://openrouter.ai/api/v1");
    expect(defaultBaseUrl("ollama")).toBe("http://localhost:11434/v1");
  });

  it("extractJson parses a JSON object embedded in prose", () => {
    const out = extractJson('Here is your bill:\n```json\n{"merchant":"Starbucks","total":5.75}\n```\nDone!');
    expect(out).toMatchObject({ merchant: "Starbucks", total: 5.75 });
  });

  it("extractJson parses bare JSON", () => {
    const out = extractJson('{"merchant":"X","total":10}');
    expect(out).toMatchObject({ merchant: "X", total: 10 });
  });

  it("extractJson returns null when no JSON present", () => {
    expect(extractJson("no json here")).toBeNull();
    expect(extractJson("")).toBeNull();
  });

  it("extractJson picks the outermost { ... } block", () => {
    const out = extractJson('prefix {"a":1} suffix {"b":2}');
    expect(out).toMatchObject({ a: 1 });
  });
});
