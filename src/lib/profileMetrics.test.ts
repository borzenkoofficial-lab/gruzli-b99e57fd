import { describe, expect, it } from "vitest";
import { aggregateProfileMetrics } from "./profileMetrics";

describe("aggregateProfileMetrics", () => {
  const start = Date.parse("2026-10-05T00:00:00.000Z");
  const end = Date.parse("2026-10-12T00:00:00.000Z");

  it("counts work by completion time and sums actual worker earnings", () => {
    const rows = [
      { completedAt: "2026-10-06T09:00:00.000Z", earned: 1200, hours_worked: 2.25 },
      { completedAt: "2026-10-08T10:00:00.000Z", earned: 800, hours_worked: 1.25 },
      { completedAt: "2026-10-02T10:00:00.000Z", earned: 700, hours_worked: 2 },
      { completedAt: null, earned: 500, hours_worked: 1 },
    ];

    expect(aggregateProfileMetrics(rows, start, end)).toEqual({
      orders: 2,
      earned: 2000,
      hours: 3.5,
    });
  });

  it("uses dispatcher income, not worker earnings, for dispatcher metrics", () => {
    const rows = [
      { completedAt: "2026-10-06T09:00:00.000Z", earned: 5000, dispatcher_income: 900 },
      { completedAt: "2026-10-09T09:00:00.000Z", earned: 7000, dispatcher_income: 1200 },
    ];

    expect(aggregateProfileMetrics(rows, start, end, "dispatcher_income")).toEqual({
      orders: 2,
      earned: 2100,
      hours: 0,
    });
  });

  it("ignores invalid timestamps and invalid numeric values without inventing a rating or metric", () => {
    const rows = [
      { completedAt: "not-a-date", earned: 100, hours_worked: 1 },
      { completedAt: "2026-10-07T12:00:00.000Z", earned: null, hours_worked: null },
    ];

    expect(aggregateProfileMetrics(rows, start, end)).toEqual({
      orders: 1,
      earned: 0,
      hours: 0,
    });
  });
});
