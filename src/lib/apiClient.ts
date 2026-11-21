export interface ApiErrorPayload {
  code?: string;
  message?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, payload: ApiErrorPayload = {}) {
    super(payload.message || "Не удалось выполнить запрос.");
    this.name = "ApiError";
    this.status = status;
    this.code = payload.code || "REQUEST_FAILED";
  }
}

export interface DispatcherOffer {
  id: string;
  job_id: string;
  dispatcher_id: string;
  proposed_hourly_rate: number | string;
  proposed_workers: number;
  message: string | null;
  status: "pending" | "accepted" | "rejected" | "withdrawn";
  created_at: string;
  updated_at: string;
  dispatcher_name?: string;
  dispatcher_avatar?: string | null;
  dispatcher_rating?: number | string;
  dispatcher_completed_orders?: number;
}

export interface DispatcherOfferJob {
  id: string;
  dispatcher_id: string;
  hourly_rate: number | string;
  workers_needed: number;
  status: string;
}

export interface SubmitDispatcherOfferInput {
  proposedHourlyRate: number;
  proposedWorkers: number;
  message?: string;
}

export interface SelectDispatcherOfferResult {
  job: DispatcherOfferJob;
  selectedOfferId: string;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // A successful 204 or a non-JSON proxy error has no response body.
  }

  if (!response.ok) {
    const errorPayload = (payload as { error?: ApiErrorPayload } | null)?.error;
    throw new ApiError(response.status, errorPayload || {});
  }

  return payload as T;
}

export async function getJobDispatcherOffers(jobId: string): Promise<DispatcherOffer[]> {
  const result = await request<{ offers: DispatcherOffer[] }>(
    `/api/jobs/${encodeURIComponent(jobId)}/offers`,
  );
  return result.offers;
}

export async function submitDispatcherOffer(
  jobId: string,
  input: SubmitDispatcherOfferInput,
): Promise<DispatcherOffer> {
  const result = await request<{ offer: DispatcherOffer }>(
    `/api/jobs/${encodeURIComponent(jobId)}/offers`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return result.offer;
}

export async function selectDispatcherOffer(offerId: string): Promise<SelectDispatcherOfferResult> {
  return request<SelectDispatcherOfferResult>(
    `/api/dispatcher-offers/${encodeURIComponent(offerId)}/select`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export type WorkerStatus = "confirmed" | "en_route" | "late" | "arrived" | "completed";

export interface WorkerResponseStatusResult {
  response: {
    id: string;
    job_id: string;
    worker_id: string;
    worker_status: WorkerStatus;
    work_started_at: string | null;
    work_finished_at: string | null;
    hours_worked: number | string | null;
    earned: number | string | null;
  };
}

export interface DispatcherJobCompletionInput {
  expensePerWorker?: number;
  dispatcherIncome: number;
}

export interface DispatcherJobCompletionResult {
  jobId: string;
  status: "completed";
  workerPayoutTotal: number;
  dispatcherIncome: number;
  workersSettled: number;
}

export async function updateWorkerResponseStatus(
  responseId: string,
  nextStatus: WorkerStatus,
  hoursWorked?: number,
): Promise<WorkerResponseStatusResult> {
  return request<WorkerResponseStatusResult>(
    `/api/responses/${encodeURIComponent(responseId)}/worker-status`,
    {
      method: "POST",
      body: JSON.stringify({ nextStatus, ...(hoursWorked === undefined ? {} : { hoursWorked }) }),
    },
  );
}

export async function cancelWorkerAssignment(responseId: string): Promise<{
  response: { id: string; job_id: string; worker_id: string; status: string; worker_status: string };
  jobStatus: string;
}> {
  return request(
    `/api/responses/${encodeURIComponent(responseId)}/cancel-assignment`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function finishDispatcherJob(jobId: string): Promise<{ jobId: string; status: "finishing"; workersNotCompleted: number }> {
  return request(
    `/api/jobs/${encodeURIComponent(jobId)}/finish`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function completeDispatcherJob(
  jobId: string,
  input: DispatcherJobCompletionInput,
): Promise<DispatcherJobCompletionResult> {
  return request<DispatcherJobCompletionResult>(
    `/api/jobs/${encodeURIComponent(jobId)}/complete`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function reviewWorkerResponse(
  responseId: string,
  rating: number,
  text?: string,
): Promise<{ responseId: string; rating: number }> {
  return request(
    `/api/responses/${encodeURIComponent(responseId)}/review`,
    { method: "POST", body: JSON.stringify({ rating, ...(text ? { text } : {}) }) },
  );
}
