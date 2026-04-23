import { filterListings } from "./filterListings";

describe("filterListings", () => {
  const sample = [
    { id: 1, district: "belize", listing_type: "for-sale", price: 100, beds: 2, baths: 1 },
    { id: 2, district: "cayo", listing_type: "rent", price: 500, beds: 3, baths: 2 },
    { id: 3, district: "belize", listing_type: "rent", price: 300, beds: 1, baths: 1 },
  ];

  test("filters by district", () => {
    expect(filterListings(sample, { district: "belize" }).map((l) => l.id)).toEqual([1, 3]);
  });

  test("filters by status (non-all)", () => {
    expect(filterListings(sample, { status: "rent" }).map((l) => l.id)).toEqual([2, 3]);
  });

  test("filters by min/max price using minPrice/maxPrice", () => {
    expect(filterListings(sample, { minPrice: 200, maxPrice: 400 }).map((l) => l.id)).toEqual([3]);
  });

  test("filters by min/max price using priceMin/priceMax (legacy)", () => {
    expect(filterListings(sample, { priceMin: 200, priceMax: 400 }).map((l) => l.id)).toEqual([3]);
  });

  test("filters by minimum beds/baths", () => {
    expect(filterListings(sample, { beds: 3, baths: 2 }).map((l) => l.id)).toEqual([2]);
  });
});

