const WORKER_STATUS_TRANSITIONS = Object.freeze({
  confirmed: [null, "ready"],
  en_route: ["confirmed", "late"],
  late: ["confirmed", "en_route", "late"],
  arrived: ["en_route", "late"],
  completed: ["arrived", "finishing"],
});

export function isWorkerStatusTransitionAllowed(currentStatus, nextStatus) {
  return WORKER_STATUS_TRANSITIONS[nextStatus]?.includes(currentStatus ?? null) ?? false;
}

export function normalizeWorkedHours(value) {
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < 0.5 || hours > 72) {
    throw new RangeError("WORKED_HOURS_OUT_OF_RANGE");
  }
  return Math.round(hours * 10) / 10;
}

export function calculateWorkerEarnings(hoursWorked, agreedHourlyRate) {
  const hours = normalizeWorkedHours(hoursWorked);
  const rate = Number(agreedHourlyRate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new RangeError("AGREED_RATE_REQUIRED");
  }
  return Math.round(hours * rate * 100) / 100;
}
