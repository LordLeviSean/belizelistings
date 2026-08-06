/** @jest-environment node */

import fs from "fs";
import path from "path";
import { FEATURED_LISTING_CARD_IMAGE_SIZES } from "../lib/listingCardBrowse";

const repoRoot = path.resolve(__dirname, "../..");

function readPage(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("ListingCard parity", () => {
  test("agent profile and homepage featured carousel import the same ListingCard component", () => {
    const agentPage = readPage("src/pages/agents/[username].jsx");
    const homePage = readPage("src/pages/index.js");

    expect(agentPage).toMatch(/import ListingCard from/);
    expect(homePage).toMatch(/import ListingCard from/);
    expect(agentPage).toMatch(/<ListingCard\b/);
    expect(homePage).toMatch(/<ListingCard\b/);
  });

  test("agent profile uses featured browse card prop builder", () => {
    const agentPage = readPage("src/pages/agents/[username].jsx");
    const browse = readPage("src/lib/listingCardBrowse.js");
    expect(agentPage).toMatch(/buildFeaturedBrowseListingCardProps/);
    expect(browse).toMatch(/showShareButton: true/);
    expect(agentPage).not.toMatch(/100vw, \(max-width: 980px\) 50vw, 33vw/);
  });

  test("agent profile grid caps card width like featured carousel items", () => {
    const css = readPage("src/styles/AgentPublicProfile.module.css");
    expect(css).toMatch(/grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(min\(296px,\s*100%\),\s*300px\)\)/);
    expect(css).toMatch(/\.gridItem[\s\S]*min-width:\s*0/);
    expect(css).toMatch(/\.grid[\s\S]*gap:\s*10px/);
  });

  test("homepage featured listings implementation remains unchanged", () => {
    const homePage = readPage("src/pages/index.js");
    expect(homePage).toContain(FEATURED_LISTING_CARD_IMAGE_SIZES);
    expect(homePage).toMatch(/featuredCarouselViewport/);
    expect(homePage).toMatch(/featuredCarouselItem/);
    expect(homePage).not.toMatch(/buildFeaturedBrowseListingCardProps/);
  });

  test("agent profile retains empty state when no listings", () => {
    const agentPage = readPage("src/pages/agents/[username].jsx");
    expect(agentPage).toMatch(/listings\.length === 0/);
    expect(agentPage).toMatch(/No public listings yet/);
  });

  test("ListingCard remains the single canonical implementation", () => {
    const listingCard = readPage("src/components/ListingCard.jsx");
    expect(listingCard).toMatch(/homeStyles\.propertyCard/);
    expect(listingCard).toMatch(/showShareButton = true/);
    expect(listingCard).toMatch(/resolveListingLifecycleBadge/);
    expect(listingCard).toMatch(/isListingCardVerified/);
  });
});

describe("agent profile listing data mapping", () => {
  test("fetchAgentPublicProfile maps images for browse cards", () => {
    const lib = readPage("src/lib/agentPublicProfile.js");
    expect(lib).toMatch(/mapListingWithImages/);
    expect(lib).toMatch(/filterBrowsableInventory/);
  });
});
