import { describe, expect, it } from "vitest";
import { getCompletionDate } from "./dispatcherStats";

describe("dispatcher completion date", () => {
  it("uses updated_at as the completion timestamp", () => {
    expect(getCompletionDate({
      created_at: "2026-10-01T10:00:00.000Z",
      updated_at: "2026-11-21T10:00:00.000Z",
    })).toBe("2026-11-21T10:00:00.000Z");
  });

  it("falls back to created_at when updated_at is missing", () => {
    expect(getCompletionDate({
      created_at: "2026-10-01T10:00:00.000Z",
      updated_at: null,
    })).toBe("2026-10-01T10:00:00.000Z");
  });
});
