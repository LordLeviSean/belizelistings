import {
  parseInlineDescriptionSegments,
  parseListingDescriptionBlocks,
} from "./listingDescriptionFormat";

describe("listingDescriptionFormat", () => {
  test("parseInlineDescriptionSegments detects phone numbers", () => {
    const segments = parseInlineDescriptionSegments("Call 501-223-4567 today.");
    expect(segments.some((s) => s.type === "phone" && s.href?.startsWith("tel:"))).toBe(true);
  });

  test("parseInlineDescriptionSegments detects URLs", () => {
    const segments = parseInlineDescriptionSegments("See https://example.com/belize for details.");
    expect(segments.some((s) => s.type === "url" && s.href === "https://example.com/belize")).toBe(
      true
    );
  });

  test("parseListingDescriptionBlocks groups bullets into lists", () => {
    const blocks = parseListingDescriptionBlocks(
      "Overview:\nSpacious home.\n\n- Garden\n- Air conditioning\n- Gated entry"
    );
    expect(blocks.some((b) => b.type === "heading" && b.label === "Overview")).toBe(true);
    expect(blocks.some((b) => b.type === "list" && b.items?.length === 3)).toBe(true);
  });

  test("parseListingDescriptionBlocks preserves plain paragraphs", () => {
    const blocks = parseListingDescriptionBlocks("Line one.\n\nLine two.");
    expect(blocks).toEqual([
      { type: "paragraph", text: "Line one." },
      { type: "paragraph", text: "Line two." },
    ]);
  });

  test("parseListingDescriptionBlocks recognizes Features section", () => {
    const blocks = parseListingDescriptionBlocks("Features:\n* Pool\n* Dock");
    expect(blocks[0]).toEqual({ type: "heading", label: "Features" });
    expect(blocks[1]).toEqual({ type: "list", items: ["Pool", "Dock"] });
  });
});
