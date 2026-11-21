import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  getJobDispatcherOffers,
  selectDispatcherOffer,
  submitDispatcherOffer,
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
