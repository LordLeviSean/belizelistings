import {
  CREATE_FORM_INITIAL,
  mapListingRowToCreateForm,
} from "./createListingForm";

describe("mapListingRowToCreateForm edit preload", () => {
  test("preloads structured Belize → Belize City → King's Park", () => {
    const form = mapListingRowToCreateForm({
      title: "Test",
      map_region_slug: "belize",
      community_id: "area-belize-belize-city",
      locality_id: "loc-belize-belize-city-kings-park",
      district: "belize-city",
      region_slug: "belize",
      subregion_slug: "belize-city",
      property_type: "house",
      listing_type: "sale",
    });
    expect(form.map_region_slug).toBe("belize");
    expect(form.community_id).toBe("area-belize-belize-city");
    expect(form.locality_id).toBe("loc-belize-belize-city-kings-park");
  });

  test("preloads highway without polluting community_id", () => {
    const form = mapListingRowToCreateForm({
      map_region_slug: "stann-creek",
      highway_id: "highway-hummingbird-highway",
      highway_mile: 12,
      community_id: null,
      property_type: "land",
      listing_type: "sale",
    });
    expect(form.highway_id).toBe("highway-hummingbird-highway");
    expect(form.community_id).toBe("");
    expect(form.highway_mile).toBe("12");
  });

  test("draft restore round-trips geography fields", () => {
    const draft = {
      ...CREATE_FORM_INITIAL,
      map_region_slug: "cayo",
      community_id: "area-cayo-san-ignacio",
      locality_id: "loc-cayo-san-ignacio-maya-vista",
      property_type: "house",
      listing_type: "sale",
    };
    const restored = mapListingRowToCreateForm({
      map_region_slug: draft.map_region_slug,
      community_id: draft.community_id,
      locality_id: draft.locality_id,
      property_type: draft.property_type,
      listing_type: draft.listing_type,
    });
    expect(restored.map_region_slug).toBe("cayo");
    expect(restored.community_id).toBe("area-cayo-san-ignacio");
    expect(restored.locality_id).toBe("loc-cayo-san-ignacio-maya-vista");
  });
});
