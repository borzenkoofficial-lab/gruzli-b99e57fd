import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateWorkerEarnings,
  isWorkerStatusTransitionAllowed,
  normalizeWorkedHours,
} from "./workerLifecycle.mjs";

test("worker status transitions follow the agreed lifecycle", () => {
  assert.equal(isWorkerStatusTransitionAllowed(null, "confirmed"), true);
  assert.equal(isWorkerStatusTransitionAllowed("ready", "confirmed"), true);
  assert.equal(isWorkerStatusTransitionAllowed("confirmed", "en_route"), true);
  assert.equal(isWorkerStatusTransitionAllowed("late", "en_route"), true);
  assert.equal(isWorkerStatusTransitionAllowed("en_route", "arrived"), true);
  assert.equal(isWorkerStatusTransitionAllowed("late", "arrived"), true);
  assert.equal(isWorkerStatusTransitionAllowed("arrived", "completed"), true);
  assert.equal(isWorkerStatusTransitionAllowed("finishing", "completed"), true);
});

test("worker status transitions reject skipped and repeated invalid steps", () => {
  assert.equal(isWorkerStatusTransitionAllowed("ready", "arrived"), false);
  assert.equal(isWorkerStatusTransitionAllowed("confirmed", "completed"), false);
  assert.equal(isWorkerStatusTransitionAllowed("completed", "arrived"), false);
  assert.equal(isWorkerStatusTransitionAllowed("rejected", "confirmed"), false);
});

test("worked hours are normalized to one decimal place and bounded", () => {
  assert.equal(normalizeWorkedHours(3.26), 3.3);
  assert.throws(() => normalizeWorkedHours(0.2), /WORKED_HOURS_OUT_OF_RANGE/);
  assert.throws(() => normalizeWorkedHours(73), /WORKED_HOURS_OUT_OF_RANGE/);
  assert.throws(() => normalizeWorkedHours(Number.NaN), /WORKED_HOURS_OUT_OF_RANGE/);
});

test("worker earnings use the agreed rate and round to kopecks", () => {
  assert.equal(calculateWorkerEarnings(2.5, 850), 2125);
  assert.equal(calculateWorkerEarnings(1.3, 499.99), 649.99);
  assert.throws(() => calculateWorkerEarnings(2, 0), /AGREED_RATE_REQUIRED/);
});
