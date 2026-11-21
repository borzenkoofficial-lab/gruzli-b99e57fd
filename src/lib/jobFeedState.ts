export type FeedJobLike = {
  id: string;
  status: string;
  created_at: string;
};

export function upsertActiveFeedJob<T extends FeedJobLike>(jobs: T[], incoming: T): T[] {
  if (incoming.status !== "active") {
    return jobs.filter((job) => job.id !== incoming.id);
  }

  const exists = jobs.some((job) => job.id === incoming.id);
  const next = exists
    ? jobs.map((job) => job.id === incoming.id ? incoming : job)
    : [...jobs, incoming];

  return next.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function removeFeedJob<T extends FeedJobLike>(jobs: T[], jobId: string): T[] {
  return jobs.filter((job) => job.id !== jobId);
}
