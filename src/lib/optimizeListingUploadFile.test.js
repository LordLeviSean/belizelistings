const {
  computeListingUploadDimensions,
  buildListingUploadStoragePath,
  LISTING_UPLOAD_MAX_SIDE_PX,
} = require("./optimizeListingUploadFile");

describe("optimizeListingUploadFile helpers", () => {
  test("computeListingUploadDimensions never upscales", () => {
    expect(computeListingUploadDimensions(800, 600)).toEqual({
      width: 800,
      height: 600,
      scaled: false,
    });
  });

  test("computeListingUploadDimensions scales longest side to max", () => {
    const out = computeListingUploadDimensions(4032, 3024, LISTING_UPLOAD_MAX_SIDE_PX);
    expect(out.scaled).toBe(true);
    expect(Math.max(out.width, out.height)).toBe(LISTING_UPLOAD_MAX_SIDE_PX);
    expect(out.width).toBe(1920);
    expect(out.height).toBe(1440);
  });

  test("buildListingUploadStoragePath uses webp slug", () => {
    const path = buildListingUploadStoragePath("user-1", 2, "Beach House.JPG");
    expect(path).toMatch(/^user-1\/\d+-2-beach-house\.webp$/);
  });
});
