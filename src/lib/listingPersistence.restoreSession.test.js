jest.mock("./createListingUploads", () => {
  const actual = jest.requireActual("./createListingUploads");
  return {
    ...actual,
    deleteListingImageRow: jest.fn().mockResolvedValue({ error: null }),
    persistListingImageOrder: jest.fn().mockResolvedValue({ error: null, rows: [] }),
  };
});

import { restoreListingToSessionBaseline } from "./listingPersistence";
import { deleteListingImageRow, persistListingImageOrder } from "./createListingUploads";

jest.mock("./listingWriteContract", () => {
  const actual = jest.requireActual("./listingWriteContract");
  return {
    ...actual,
    executeListingUpdate: jest.fn().mockResolvedValue({ error: null, data: { id: "12" } }),
  };
});

import { executeListingUpdate } from "./listingWriteContract";

function mockSupabaseForRestore({ currentImages = [], finalImages = currentImages }) {
  let imageRows = [...currentImages];
  const from = jest.fn((table) => {
    if (table === "listing_images") {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockImplementation(() =>
          Promise.resolve({ data: imageRows, error: null })
        ),
        insert: jest.fn().mockImplementation(({ image_url, position }) => {
          const row = {
            id: `new-${imageRows.length + 1}`,
            image_url,
            position,
            listing_id: "12",
          };
          imageRows.push(row);
          return { error: null };
        }),
      };
    }
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
  });

  const supabase = { from };
  Object.defineProperty(supabase, "_setFinalImages", {
    value: () => {
      imageRows = [...finalImages];
    },
  });
  return supabase;
}

describe("restoreListingToSessionBaseline", () => {
  beforeEach(() => {
    executeListingUpdate.mockClear();
    deleteListingImageRow.mockClear();
    persistListingImageOrder.mockClear();
  });

  test("patches baseline form and removes session-added images", async () => {
    const supabase = mockSupabaseForRestore({
      currentImages: [
        { id: "img-1", image_url: "https://example.test/a.webp", position: 0 },
        { id: "img-2", image_url: "https://example.test/b.webp", position: 1 },
      ],
    });

    const { error } = await restoreListingToSessionBaseline(supabase, {
      listingId: "12",
      baselineForm: { title: "Original", property_type: "house", listing_type: "sale" },
      baselineRemoteImages: [{ id: "img-1", image_url: "https://example.test/a.webp", position: 0 }],
      authUserId: "user-1",
      eqFilters: { user_id: "user-1" },
    });

    expect(error).toBeNull();
    expect(executeListingUpdate).toHaveBeenCalled();
    expect(deleteListingImageRow).toHaveBeenCalledWith(supabase, "img-2");
    expect(persistListingImageOrder).toHaveBeenCalled();
  });

  test("returns friendly error when patch fails", async () => {
    executeListingUpdate.mockResolvedValueOnce({ error: new Error("patch failed") });
    const supabase = mockSupabaseForRestore({ currentImages: [] });

    const { error } = await restoreListingToSessionBaseline(supabase, {
      listingId: "12",
      baselineForm: { title: "Original", property_type: "house", listing_type: "sale" },
      baselineRemoteImages: [],
      authUserId: "user-1",
      eqFilters: { user_id: "user-1" },
    });

    expect(error?.message).toBe("Unable to restore your listing. Please try again or keep editing.");
    expect(String(error?.message)).not.toMatch(/patch failed/i);
  });
});
