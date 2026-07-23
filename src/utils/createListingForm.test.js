import {
  CREATE_FORM_INITIAL,
  formatListingNumericFormField,
  mapListingRowToCreateForm,
  normalizePropertyTypeForForm,
  resolveListingTypeForForm,
} from "./createListingForm";
import { buildDraftAutosavePayload } from "../lib/listingPersistence";

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

  test("rental listing opens with For Rent selected via listing_type", () => {
    const form = mapListingRowToCreateForm({
      property_type: "commercial",
      listing_type: "rent",
    });
    expect(form.listing_type).toBe("rent");
  });

  test("rental listing opens with For Rent via market_type when listing_type is absent", () => {
    const form = mapListingRowToCreateForm({
      property_type: "commercial",
      market_type: "rent",
    });
    expect(form.listing_type).toBe("rent");
    expect(resolveListingTypeForForm({ market_type: "rent" })).toBe("rent");
  });

  test("sale listing opens with For Sale selected", () => {
    const form = mapListingRowToCreateForm({
      property_type: "house",
      listing_type: "sale",
    });
    expect(form.listing_type).toBe("sale");
  });

  test("existing property type is restored", () => {
    expect(normalizePropertyTypeForForm("commercial")).toBe("commercial");
    expect(mapListingRowToCreateForm({ property_type: "commercial" }).property_type).toBe(
      "commercial"
    );
    expect(mapListingRowToCreateForm({ property_type: "building" }).property_type).toBe(
      "commercial"
    );
  });

  test("bedrooms, bathrooms, garages, and square footage are restored", () => {
    const form = mapListingRowToCreateForm({
      beds: 3,
      baths: 2,
      garage: 1,
      square_feet: 1800,
      property_type: "house",
      listing_type: "sale",
    });
    expect(form.beds).toBe("3");
    expect(form.baths).toBe("2");
    expect(form.garage).toBe("1");
    expect(form.square_feet).toBe("1800");
  });

  test("zero-value numeric fields remain zero", () => {
    const form = mapListingRowToCreateForm({
      beds: 0,
      baths: 0,
      garage: 0,
      square_feet: 0,
      property_type: "land",
      listing_type: "sale",
    });
    expect(form.beds).toBe("0");
    expect(form.baths).toBe("0");
    expect(form.garage).toBe("0");
    expect(form.square_feet).toBe("0");
    expect(formatListingNumericFormField(0)).toBe("0");
  });

  test("autosave preserves untouched garage when editing one field", () => {
    const form = mapListingRowToCreateForm({
      title: "Coastal Villa",
      beds: 4,
      baths: 3,
      garage: 2,
      square_feet: 2200,
      property_type: "house",
      listing_type: "rent",
      market_type: "rent",
    });
    const edited = { ...form, title: "Coastal Villa Updated" };
    const payload = buildDraftAutosavePayload({
      form: edited,
      authUserId: "user-1",
      sourceLifecycle: "approved",
    });
    expect(payload.title).toBe("Coastal Villa Updated");
    expect(payload.beds).toBe(4);
    expect(payload.baths).toBe(3);
    expect(payload.garage).toBe(2);
    expect(payload.square_feet).toBe(2200);
    expect(payload.listing_type).toBe("rent");
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
