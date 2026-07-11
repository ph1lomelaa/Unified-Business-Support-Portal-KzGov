import { beforeEach, describe, expect, it } from "vitest";
import {
  clearNavSnapshot,
  loadNavSnapshot,
  saveNavSnapshot,
  type NavSnapshot,
} from "../navigator-session";

const snapshot: NavSnapshot = {
  query: "ферма, нужен кредит на закуп скота",
  result: {
    recommendations: [
      // минимальный ServiceCard — важны query/result, а не полнота карточки
      { service: { slug: "akk-animal", title: "Кредит" } as never, reason: "подходит" },
    ],
    clarify: null,
    source: "ai",
  },
};

describe("navigator-session", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("returns null when nothing is stored", () => {
    expect(loadNavSnapshot()).toBeNull();
  });

  it("round-trips the last query and results", () => {
    saveNavSnapshot(snapshot);
    const loaded = loadNavSnapshot();
    expect(loaded?.query).toBe(snapshot.query);
    expect(loaded?.result.recommendations).toHaveLength(1);
    expect(loaded?.result.source).toBe("ai");
  });

  it("clears the snapshot", () => {
    saveNavSnapshot(snapshot);
    clearNavSnapshot();
    expect(loadNavSnapshot()).toBeNull();
  });

  it("ignores corrupted storage payloads", () => {
    window.sessionStorage.setItem("eppb_navigator", "{not json");
    expect(loadNavSnapshot()).toBeNull();
  });

  it("rejects payloads missing a recommendations array", () => {
    window.sessionStorage.setItem(
      "eppb_navigator",
      JSON.stringify({ query: "x", result: { clarify: null } })
    );
    expect(loadNavSnapshot()).toBeNull();
  });
});
