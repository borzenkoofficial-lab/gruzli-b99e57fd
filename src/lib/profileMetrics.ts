export type ProfileMetricRow = {
  completedAt?: string | null;
  earned?: number | string | null;
  hours_worked?: number | string | null;
  dispatcher_income?: number | string | null;
};

export type ProfileMetrics = {
  orders: number;
  earned: number;
  hours: number;
};

/** Aggregates only records whose completion timestamp falls inside the requested period. */
export function aggregateProfileMetrics(
  rows: readonly ProfileMetricRow[],
  startAt: number,
  endAt: number,
  amountKey: "earned" | "dispatcher_income" = "earned",
): ProfileMetrics {
  const completed = rows.filter((row) => {
    if (!row.completedAt) return false;
    const timestamp = Date.parse(row.completedAt);
    return Number.isFinite(timestamp) && timestamp >= startAt && timestamp <= endAt;
  });

  const toFiniteNumber = (value: unknown) => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const earned = completed.reduce((sum, row) => sum + toFiniteNumber(row[amountKey]), 0);
  const hours = completed.reduce((sum, row) => sum + toFiniteNumber(row.hours_worked), 0);

  return {
    orders: completed.length,
    earned,
    hours: Math.round(hours * 10) / 10,
  };
}
