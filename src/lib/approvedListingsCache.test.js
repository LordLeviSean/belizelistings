import {
  getCachedApprovedListings,
  invalidateApprovedListingsCache,
  peekCachedApprovedListings,
} from "./approvedListingsCache";
import { fetchApprovedListingsWithImages } from "./listingQueries";

jest.mock("./listingQueries", () => ({
  fetchApprovedListingsWithImages: jest.fn(),
}));

describe("approvedListingsCache", () => {
  beforeEach(() => {
    invalidateApprovedListingsCache();
    fetchApprovedListingsWithImages.mockReset();
  });

  it("deduplicates concurrent fetches", async () => {
    fetchApprovedListingsWithImages.mockResolvedValue({
      data: [{ id: 1 }],
      error: null,
    });

    const [a, b] = await Promise.all([
      getCachedApprovedListings(),
      getCachedApprovedListings(),
    ]);

    expect(fetchApprovedListingsWithImages).toHaveBeenCalledTimes(1);
    expect(a.data).toEqual([{ id: 1 }]);
    expect(b.data).toEqual([{ id: 1 }]);
    expect(peekCachedApprovedListings()).toEqual([{ id: 1 }]);
  });

  it("serves cache without refetch until forceRefresh", async () => {
    fetchApprovedListingsWithImages.mockResolvedValue({
      data: [{ id: 2 }],
      error: null,
    });

    await getCachedApprovedListings();
    await getCachedApprovedListings();

    expect(fetchApprovedListingsWithImages).toHaveBeenCalledTimes(1);

    await getCachedApprovedListings({ forceRefresh: true });
    expect(fetchApprovedListingsWithImages).toHaveBeenCalledTimes(2);
  });
});
