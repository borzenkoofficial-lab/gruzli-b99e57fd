import { describe, expect, it } from "vitest";
import { removeFeedJob, upsertActiveFeedJob, type FeedJobLike } from "./jobFeedState";

type Job = FeedJobLike & { title: string };

const makeJob = (id: string, status: string, created_at: string): Job => ({
  id,
  status,
  created_at,
  title: id,
});

describe("job feed realtime state", () => {
  it("does not add a non-active job", () => {
    const jobs = [makeJob("active", "active", "2026-11-21T10:00:00Z")];
    expect(upsertActiveFeedJob(jobs, makeJob("draft", "draft", "2026-11-21T11:00:00Z"))).toEqual(jobs);
  });

  it("removes a job when it becomes non-active", () => {
    const jobs = [
      makeJob("one", "active", "2026-11-21T10:00:00Z"),
      makeJob("two", "active", "2026-11-21T09:00:00Z"),
    ];
    expect(upsertActiveFeedJob(jobs, makeJob("one", "filled", "2026-11-21T10:00:00Z"))).toEqual([jobs[1]]);
  });

  it("updates existing active jobs without creating duplicates", () => {
    const jobs = [makeJob("one", "active", "2026-11-21T10:00:00Z")];
    const updated = makeJob("one", "active", "2026-11-21T12:00:00Z");
    expect(upsertActiveFeedJob(jobs, updated)).toEqual([updated]);
  });

  it("adds new active jobs and sorts newest first", () => {
    const older = makeJob("older", "active", "2026-11-21T09:00:00Z");
    const newer = makeJob("newer", "active", "2026-11-21T11:00:00Z");
    expect(upsertActiveFeedJob([older], newer)).toEqual([newer, older]);
  });

  it("removes deleted jobs", () => {
    const jobs = [
      makeJob("one", "active", "2026-11-21T10:00:00Z"),
      makeJob("two", "active", "2026-11-21T09:00:00Z"),
    ];
    expect(removeFeedJob(jobs, "one")).toEqual([jobs[1]]);
  });
});
