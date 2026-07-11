import { describe, expect, it } from "vitest";
import { extractJson } from "../ai-json";

describe("extractJson", () => {
  it("parses fenced model JSON", () => {
    expect(extractJson("```json\n{\"ok\":true}\n```")).toEqual({ ok: true });
  });

  it("parses JSON surrounded by prose", () => {
    expect(extractJson("Ответ:\n{\"recommendations\":[{\"serviceId\":\"x\"}]}")).toEqual({
      recommendations: [{ serviceId: "x" }],
    });
  });

  it("throws when JSON is absent", () => {
    expect(() => extractJson("plain text")).toThrow("JSON not found");
  });
});
