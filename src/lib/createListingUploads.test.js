import {
  normalizeOrderedImageRows,
  persistListingImageOrder,
} from "./createListingUploads";

describe("createListingUploads", () => {
  test("normalizeOrderedImageRows assigns contiguous positions with hero at 0", () => {
    const rows = normalizeOrderedImageRows([
      { id: "b", image_url: "b.jpg", position: 5 },
      { id: "a", image_url: "a.jpg", position: 2 },
    ]);
    expect(rows[0]).toMatchObject({ id: "b", position: 0 });
    expect(rows[1]).toMatchObject({ id: "a", position: 1 });
  });

  test("persistListingImageOrder updates position column for each row", async () => {
    const updates = [];
    const supabase = {
      from: jest.fn(() => ({
        update: jest.fn((payload) => ({
          eq: jest.fn(async (col, id) => {
            updates.push({ id, payload });
            return { error: null };
          }),
        })),
      })),
    };

    const rows = [
      { id: "img-2", image_url: "two.jpg" },
      { id: "img-1", image_url: "one.jpg" },
    ];
    const result = await persistListingImageOrder(supabase, rows);

    expect(result.error).toBeNull();
    expect(result.rows[0]).toMatchObject({ id: "img-2", position: 0 });
    expect(result.rows[1]).toMatchObject({ id: "img-1", position: 1 });
    expect(updates).toEqual([
      { id: "img-2", payload: { position: 0 } },
      { id: "img-1", payload: { position: 1 } },
    ]);
  });
});
