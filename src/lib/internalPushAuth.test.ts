import { describe, expect, it } from "vitest";
import { hasValidInternalBearer } from "../../supabase/functions/_shared/internalAuth";

const SECRET = "test-only-internal-secret";

function request(authorization?: string) {
  return new Request("https://gruzli.example.test/functions/v1/send-push", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  });
}

describe("internal push endpoint authorization", () => {
  it("accepts the configured internal bearer secret", () => {
    expect(hasValidInternalBearer(request(`Bearer ${SECRET}`), SECRET)).toBe(true);
  });

  it("rejects missing credentials and an unconfigured secret", () => {
    expect(hasValidInternalBearer(request(), SECRET)).toBe(false);
    expect(hasValidInternalBearer(request(`Bearer ${SECRET}`), "")).toBe(false);
    expect(hasValidInternalBearer(request(`Bearer ${SECRET}`), null)).toBe(false);
  });

  it("rejects public anon keys and malformed bearer headers", () => {
    expect(hasValidInternalBearer(request("Bearer public-anon-key"), SECRET)).toBe(false);
    expect(hasValidInternalBearer(request(SECRET), SECRET)).toBe(false);
    expect(hasValidInternalBearer(request(`bearer ${SECRET}`), SECRET)).toBe(false);
  });
});
