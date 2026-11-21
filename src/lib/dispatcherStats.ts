type CompletionDateSource = {
  created_at: string;
  updated_at?: string | null;
};

export function getCompletionDate(job: CompletionDateSource): string {
  return job.updated_at || job.created_at;
}
