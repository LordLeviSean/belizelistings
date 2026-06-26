const ORIGINAL_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://yxepbzezoroaeagzzzui.supabase.co";
});

afterAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_SUPABASE_URL;
});

const {
  resolveListingImageUrl,
  getListingCoverImageUrl,
  getListingGalleryImages,
  mapListingWithImages,
  normalizeListingImageEntry,
  dedupeListingImagesBucketPath,
} = require("./listingImage");

describe("listingImage gallery normalization", () => {
  test("resolveListingImageUrl upgrades protocol-relative URLs", () => {
    expect(
      resolveListingImageUrl("//yxepbzezoroaeagzzzui.supabase.co/storage/v1/object/public/listing-images/a.jpg")
    ).toBe("https://yxepbzezoroaeagzzzui.supabase.co/storage/v1/object/public/listing-images/a.jpg");
  });

  test("resolveListingImageUrl prefixes Supabase storage paths with project origin", () => {
    expect(resolveListingImageUrl("/storage/v1/object/public/listing-images/user/photo.jpg")).toBe(
      "https://yxepbzezoroaeagzzzui.supabase.co/storage/v1/object/public/listing-images/user/photo.jpg"
    );
  });

  test("resolveListingImageUrl upgrades http Supabase URLs to https for Next/Image", () => {
    expect(
      resolveListingImageUrl(
        "http://yxepbzezoroaeagzzzui.supabase.co/storage/v1/object/public/listing-images/user/a.jpg"
      )
    ).toBe("https://yxepbzezoroaeagzzzui.supabase.co/storage/v1/object/public/listing-images/user/a.jpg");
  });

  test("resolveListingImageUrl qualifies bare storage object keys and bucket-relative paths", () => {
    const userId = "550e8400-e29b-41d4-a716-446655440000";
    expect(resolveListingImageUrl(`${userId}/1710000000000-1-photo.jpg`)).toBe(
      `https://yxepbzezoroaeagzzzui.supabase.co/storage/v1/object/public/listing-images/${userId}/1710000000000-1-photo.jpg`
    );
    expect(resolveListingImageUrl(`/listing-images/${userId}/1710000000000-2-photo.jpg`)).toBe(
      `https://yxepbzezoroaeagzzzui.supabase.co/storage/v1/object/public/listing-images/${userId}/1710000000000-2-photo.jpg`
    );
    expect(
      resolveListingImageUrl("storage/v1/object/public/listing-images/user/c.jpg")
    ).toBe("https://yxepbzezoroaeagzzzui.supabase.co/storage/v1/object/public/listing-images/user/c.jpg");
  });

  test("normalizeListingImageEntry resolves alternate row keys like getListingGalleryImages", () => {
    expect(
      normalizeListingImageEntry({
        path: "/storage/v1/object/public/listing-images/user/alt.jpg",
      })
    ).toBe("https://yxepbzezoroaeagzzzui.supabase.co/storage/v1/object/public/listing-images/user/alt.jpg");
  });

  test("getListingGalleryImages resolves alternate row keys and sorts by position", () => {
    const rows = getListingGalleryImages({
      listing_images: [
        { url: "/storage/v1/object/public/listing-images/user/c.jpg", position: 2 },
        { image_url: "https://yxepbzezoroaeagzzzui.supabase.co/storage/v1/object/public/listing-images/user/a.jpg", position: 0 },
        { path: "//yxepbzezoroaeagzzzui.supabase.co/storage/v1/object/public/listing-images/user/b.jpg", position: 1 },
      ],
    });

    expect(rows).toHaveLength(3);
    expect(rows[0].image_url).toContain("/a.jpg");
    expect(rows[1].image_url).toMatch(/^https:\/\//);
    expect(rows[1].image_url).toContain("/b.jpg");
    expect(rows[2].image_url).toContain("/c.jpg");
  });

  test("getListingGalleryImages resolves mixed cover vs non-cover URL tiers", () => {
    const userId = "550e8400-e29b-41d4-a716-446655440000";
    const rows = getListingGalleryImages({
      listing_images: [
        {
          image_url:
            "https://yxepbzezoroaeagzzzui.supabase.co/storage/v1/object/public/listing-images/user/cover.jpg",
          position: 0,
        },
        {
          image_url: `//yxepbzezoroaeagzzzui.supabase.co/storage/v1/object/public/listing-images/${userId}/b.jpg`,
          position: 1,
        },
        { url: "/storage/v1/object/public/listing-images/user/c.jpg", position: 2 },
        { image_url: `${userId}/1710000000000-3-photo.jpg`, position: 3 },
        { path: `/listing-images/${userId}/1710000000000-4-photo.jpg`, position: 4 },
      ],
    });

    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row.image_url).toMatch(/^https:\/\//);
    }
  });

  test("getListingCoverImageUrl returns lowest position image", () => {
    const url = getListingCoverImageUrl({
      listing_images: [
        { image_url: "/listings/second", position: 2 },
        { image_url: "/listings/cover", position: 0 },
        { image_url: "/listings/middle", position: 1 },
      ],
    });
    expect(url).toBe("/listings/cover.png");
  });

  test("cover vs gallery image 2 share the same normalized Supabase public URL shape", () => {
    const userId = "5bd42cf0-daf0-4076-b0d2-e6a1f9d2a6b1";
    const origin = "https://xyepbzezoroaeagzzzui.supabase.co";
    const coverRaw = `${origin}/storage/v1/object/public/listing-images/${userId}/1782229825777-0-1.png`;
    const image2Raw = `${origin}/storage/v1/object/public/listing-images/${userId}/1782229841664-1-2.png`;

    const cover = resolveListingImageUrl(coverRaw);
    const image2 = resolveListingImageUrl(image2Raw);

    expect(cover).toBe(coverRaw);
    expect(image2).toBe(image2Raw);
    expect(cover).toMatch(
      /^https:\/\/xyepbzezoroaeagzzzui\.supabase\.co\/storage\/v1\/object\/public\/listing-images\/[0-9a-f-]+\/\d+-\d+-[\w.-]+$/
    );
    expect(image2).toMatch(
      /^https:\/\/xyepbzezoroaeagzzzui\.supabase\.co\/storage\/v1\/object\/public\/listing-images\/[0-9a-f-]+\/\d+-\d+-[\w.-]+$/
    );

    const rows = getListingGalleryImages({
      listing_images: [
        { image_url: coverRaw, position: 0 },
        { image_url: image2Raw, position: 1 },
      ],
    });
    expect(rows[0].image_url).toBe(cover);
    expect(rows[1].image_url).toBe(image2);
  });

  test("dedupeListingImagesBucketPath collapses duplicate bucket segments", () => {
    expect(
      dedupeListingImagesBucketPath(
        "https://xyepbzezoroaeagzzzui.supabase.co/storage/v1/object/public/listing-images/listing-images/user/a.jpg"
      )
    ).toBe(
      "https://xyepbzezoroaeagzzzui.supabase.co/storage/v1/object/public/listing-images/user/a.jpg"
    );
    expect(resolveListingImageUrl("listing-images/listing-images/user/a.jpg")).toBe(
      "https://yxepbzezoroaeagzzzui.supabase.co/storage/v1/object/public/listing-images/user/a.jpg"
    );
  });

  test("mapListingWithImages mirrors normalized rows on listing_images and images", () => {
    const mapped = mapListingWithImages({
      id: "1",
      listing_images: [{ image_url: "/listings/house1", position: 0 }],
    });
    expect(mapped.images).toEqual(mapped.listing_images);
    expect(mapped.images[0].image_url).toBe("/listings/house1.png");
  });
});
