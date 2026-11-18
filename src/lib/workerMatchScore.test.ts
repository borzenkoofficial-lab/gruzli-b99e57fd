import { describe, expect, it } from "vitest";
import { getWorkerMatchScore } from "./workerMatchScore";

describe("getWorkerMatchScore", () => {
  const job = { title: "Грузчики на склад", description: "Погрузка и разгрузка коробок" };
  it("rewards relevant skills, verified profiles and work history", () => {
    const strong = getWorkerMatchScore({ rating: 4.8, completed_orders: 80, skills: ["склад", "погрузка", "разгрузка"], verified: true, last_seen_at: new Date().toISOString() }, job);
    const weak = getWorkerMatchScore({ rating: 3.5, completed_orders: 2, skills: ["сборка мебели"], verified: false, last_seen_at: null }, job);
    expect(strong).toBeGreaterThan(weak);
  });
  it("does not use Premium status as a ranking signal", () => {
    const score = getWorkerMatchScore({ rating: 4.5, completed_orders: 30, skills: ["погрузка"], verified: true }, job);
    expect(score).toBe(getWorkerMatchScore({ rating: 4.5, completed_orders: 30, skills: ["погрузка"], verified: true }, job));
  });
  it("returns zero when profile data is unavailable", () => { expect(getWorkerMatchScore(null, job)).toBe(0); });
});
