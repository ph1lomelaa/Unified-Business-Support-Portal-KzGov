export function extractJson<T = unknown>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/gm, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const objectStart = cleaned.indexOf("{");
    const arrayStart = cleaned.indexOf("[");
    const starts = [objectStart, arrayStart].filter((x) => x >= 0);
    const start = Math.min(...starts);
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (Number.isFinite(start) && start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new Error("JSON not found");
  }
}
