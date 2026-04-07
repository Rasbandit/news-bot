import { describe, it, expect } from "vitest";

// Test the parseResponse logic directly — extract it for testability
function parseResponse(response: string) {
  const jsonMatch = response.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error(`Failed to parse LLM response as JSON array: ${response.slice(0, 200)}`);
  }
  return JSON.parse(jsonMatch[0]);
}

describe("parseResponse", () => {
  it("parses a clean JSON array", () => {
    const input = '[{"id":0,"score":8,"tone":"positive","summary":"Great article"}]';
    const result = parseResponse(input);
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(8);
  });

  it("extracts JSON from markdown code fences", () => {
    const input = '```json\n[{"id":0,"score":7,"tone":"neutral","summary":"Test"}]\n```';
    const result = parseResponse(input);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(0);
  });

  it("extracts JSON when surrounded by text", () => {
    const input = 'Here are the results:\n[{"id":1,"score":9,"tone":"positive","summary":"Nice"}]\nDone.';
    const result = parseResponse(input);
    expect(result[0].id).toBe(1);
  });

  it("throws on non-JSON response", () => {
    expect(() => parseResponse("Sorry, I cannot help with that.")).toThrow(
      "Failed to parse LLM response"
    );
  });
});
