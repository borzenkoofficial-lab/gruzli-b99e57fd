import { describe, expect, it } from "vitest";
import { classifyJob, getCategory } from "@/lib/jobCategories";

describe("job category classification", () => {
  it("classifies moving and loading work as movers", () => {
    expect(classifyJob({ title: "Грузчики на переезд" })).toBe("movers");
  });

  it("classifies demolition and cleanup as handyman work", () => {
    expect(classifyJob({ title: "Демонтаж перегородок и вынос мусора" })).toBe("handyman");
  });

  it("classifies electrical installation as specialist work", () => {
    expect(classifyJob({ title: "Монтаж электрики на объекте" })).toBe("specialist");
  });

  it("uses the other category when no known keyword matches", () => {
    expect(classifyJob({ title: "Помощь на мероприятии" })).toBe("other");
  });

  it("returns the fallback category definition for other", () => {
    expect(getCategory("other").label).toBe("Другое");
  });
});
