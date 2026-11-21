import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  completeDispatcherJob,
  finishDispatcherJob,
  getJobDispatcherOffers,
  reviewWorkerResponse,
  selectDispatcherOffer,
  submitDispatcherOffer,
  updateWorkerResponseStatus,
} from "./apiClient";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Amvera API client — dispatcher offers", () => {
  it("loads offers using same-origin credentials", async () => {
    const offers = [{ id: "offer-1", status: "pending" }];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ offers }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getJobDispatcherOffers("job/with space")).resolves.toEqual(offers);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/jobs/job%2Fwith%20space/offers",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("submits dispatcher offer data as JSON", async () => {
    const offer = { id: "offer-2", status: "pending" };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ offer }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(submitDispatcherOffer("job-2", {
      proposedHourlyRate: 850,
      proposedWorkers: 3,
      message: "Готов организовать бригаду",
    })).resolves.toEqual(offer);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/jobs/job-2/offers",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          proposedHourlyRate: 850,
          proposedWorkers: 3,
          message: "Готов организовать бригаду",
        }),
        credentials: "include",
      }),
    );
  });

  it("selects an offer and returns the assigned job", async () => {
    const result = { job: { id: "job-3", status: "active" }, selectedOfferId: "offer-3" };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => result,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(selectDispatcherOffer("offer-3")).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/dispatcher-offers/offer-3/select",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("preserves server error code, message, and HTTP status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: { code: "JOB_ALREADY_ASSIGNED", message: "Заявка уже назначена." } }),
    }));

    await expect(selectDispatcherOffer("offer-4")).rejects.toMatchObject({
      name: "ApiError",
      status: 409,
      code: "JOB_ALREADY_ASSIGNED",
      message: "Заявка уже назначена.",
    });
  });

  it("uses a safe fallback for non-JSON errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => { throw new Error("invalid json"); },
    }));

    await expect(getJobDispatcherOffers("job-5")).rejects.toBeInstanceOf(ApiError);
    await expect(getJobDispatcherOffers("job-5")).rejects.toMatchObject({
      status: 502,
      code: "REQUEST_FAILED",
    });
  });
});


describe("Amvera API client — worker and dispatcher lifecycle", () => {
  it("submits actual worked hours when a worker completes a job", async () => {
    const response = { response: { id: "response-1", worker_status: "completed", hours_worked: 3.5 } };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => response });
    vi.stubGlobal("fetch", fetchMock);

    await expect(updateWorkerResponseStatus("response-1", "completed", 3.5)).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/responses/response-1/worker-status",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ nextStatus: "completed", hoursWorked: 3.5 }),
      }),
    );
  });

  it("starts dispatcher finishing stage", async () => {
    const result = { jobId: "job-6", status: "finishing", workersNotCompleted: 2 };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => result });
    vi.stubGlobal("fetch", fetchMock);

    await expect(finishDispatcherJob("job-6")).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/jobs/job-6/finish",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("submits dispatcher income for transactional settlement", async () => {
    const result = {
      jobId: "job-7",
      status: "completed",
      workerPayoutTotal: 5100,
      dispatcherIncome: 8000,
      workersSettled: 2,
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => result });
    vi.stubGlobal("fetch", fetchMock);

    await expect(completeDispatcherJob("job-7", {
      expensePerWorker: 0,
      dispatcherIncome: 8000,
    })).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/jobs/job-7/complete",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ expensePerWorker: 0, dispatcherIncome: 8000 }),
      }),
    );
  });

  it("saves dispatcher worker reviews", async () => {
    const result = { responseId: "response-8", rating: 5 };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => result });
    vi.stubGlobal("fetch", fetchMock);

    await expect(reviewWorkerResponse("response-8", 5, "Вовремя и аккуратно")).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/responses/response-8/review",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ rating: 5, text: "Вовремя и аккуратно" }),
      }),
    );
  });
});
