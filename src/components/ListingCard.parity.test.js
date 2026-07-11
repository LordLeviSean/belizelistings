/** @jest-environment node */

import fs from "fs";
import path from "path";

describe("ListingCard parity", () => {
  test("agent profile and homepage featured carousel import the same ListingCard component", () => {
    const repoRoot = path.resolve(__dirname, "../..");
    const agentPage = fs.readFileSync(path.join(repoRoot, "src/pages/agents/[username].jsx"), "utf8");
    const homePage = fs.readFileSync(path.join(repoRoot, "src/pages/index.js"), "utf8");

    expect(agentPage).toMatch(/import ListingCard from/);
    expect(homePage).toMatch(/import ListingCard from/);
    expect(agentPage).toMatch(/<ListingCard\b/);
    expect(homePage).toMatch(/<ListingCard\b/);
  });
});
