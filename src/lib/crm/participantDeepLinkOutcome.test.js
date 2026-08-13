/** @jest-environment node */

import {
  classifyParticipantDeepLinkFetchResult,
  mapParticipantDeepLinkResultToState,
} from "./participantDeepLinkOutcome";

describe("participantDeepLinkOutcome", () => {
  test("mapParticipantDeepLinkResultToState maps resolved, missing, and error", () => {
    expect(mapParticipantDeepLinkResultToState({ outcome: "resolved" })).toBe("resolved");
    expect(mapParticipantDeepLinkResultToState({ resolved: true })).toBe("resolved");
    expect(mapParticipantDeepLinkResultToState({ outcome: "missing" })).toBe("missing");
    expect(mapParticipantDeepLinkResultToState({ outcome: "error" })).toBe("error");
    expect(mapParticipantDeepLinkResultToState({})).toBe("idle");
  });

  test("classifyParticipantDeepLinkFetchResult distinguishes missing row from query error", () => {
    expect(classifyParticipantDeepLinkFetchResult({ data: null, error: null })).toEqual({
      outcome: "missing",
      error: null,
    });
    expect(
      classifyParticipantDeepLinkFetchResult({
        data: null,
        error: { message: "network failure" },
      })
    ).toEqual({
      outcome: "error",
      error: { message: "network failure" },
    });
    expect(classifyParticipantDeepLinkFetchResult({ data: { id: "conv-1" }, error: null })).toEqual({
      outcome: "resolved",
      error: null,
    });
  });
});
