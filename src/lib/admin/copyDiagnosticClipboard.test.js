/** @jest-environment jsdom */

import { copyDiagnosticTextToClipboard } from "./copyDiagnosticClipboard";

describe("copyDiagnosticTextToClipboard", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("uses navigator.clipboard when available", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    const result = await copyDiagnosticTextToClipboard("trace text");

    expect(result.ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith("trace text");
  });

  test("returns error when clipboard write fails without throwing", async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockRejectedValue(new Error("denied")),
      },
    });

    const result = await copyDiagnosticTextToClipboard("trace text");

    expect(result.ok).toBe(false);
    expect(result.error).toContain("denied");
  });

  test("rejects empty content", async () => {
    const result = await copyDiagnosticTextToClipboard("");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("empty_content");
  });
});
