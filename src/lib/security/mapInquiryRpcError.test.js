/** @jest-environment node */

import { mapInquiryRpcError, parseInquiryErrorCode } from "./mapInquiryRpcError";

describe("mapInquiryRpcError", () => {
  test("maps rate_limited_listing to 429", () => {
    const mapped = mapInquiryRpcError({
      message: "rate_limited_listing: maximum guest inquiries per listing per hour exceeded",
    });
    expect(mapped.status).toBe(429);
    expect(mapped.code).toBe("rate_limited_listing");
  });

  test("maps rate_limited_global to 429", () => {
    const mapped = mapInquiryRpcError({ message: "rate_limited_global: too many" });
    expect(mapped.status).toBe(429);
    expect(mapped.code).toBe("rate_limited_global");
  });

  test("maps listing unavailable to 404", () => {
    const mapped = mapInquiryRpcError({ message: "listing not found or not publicly available" });
    expect(mapped.status).toBe(404);
    expect(mapped.code).toBe("listing_unavailable");
  });

  test("parseInquiryErrorCode extracts rate limit prefix", () => {
    expect(parseInquiryErrorCode("rate_limited_listing: x")).toBe("rate_limited_listing");
    expect(parseInquiryErrorCode("rate_limited_global: x")).toBe("rate_limited_global");
    expect(parseInquiryErrorCode("other")).toBeNull();
  });
});
