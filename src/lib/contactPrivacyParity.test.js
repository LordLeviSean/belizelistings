/** @jest-environment node */

import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("contact privacy parity", () => {
  test("agent public profile does not reference raw auth email", () => {
    const agentPage = readSource("src/pages/agents/[username].jsx");
    expect(agentPage).toMatch(/resolvePublicContactEmail/);
    expect(agentPage).toMatch(/resolvePublicContactPhone/);
    expect(agentPage).not.toMatch(/profile\?\.email/);
  });

  test("public agent queries prefer PROFILE_PUBLIC_AGENT_SELECT", () => {
    const agentLib = readSource("src/lib/agentPublicProfile.js");
    expect(agentLib).toMatch(/PROFILE_PUBLIC_AGENT_SELECT/);
    expect(agentLib).toMatch(/fetchPublicAgentProfileByUsername/);
  });

  test("Profile visibility panel labels public email consent", () => {
    const panel = readSource("src/components/profile/ProfileCompletionPanel.jsx");
    expect(panel).toMatch(/Show my email publicly/);
    expect(panel).toMatch(/show_email_public === true/);
    expect(panel).toMatch(/auth_email: email/);
  });

  test("contact save sets contact_email_display only when email is public", () => {
    const mutations = readSource("src/lib/profileContactMutations.js");
    expect(mutations).toMatch(/show_email_public: showEmailPublic/);
    expect(mutations).toMatch(/contact_email_display: showEmailPublic/);
  });

  test("ContactAgentModal uses consent-aware resolver helpers", () => {
    const modal = readSource("src/components/listing/ContactAgentModal.jsx");
    expect(modal).toMatch(/hasPublicDirectContactMethods/);
    expect(modal).toMatch(/Direct contact details are private/);
    expect(modal).toMatch(/showEmailPublic === true/);
  });

  test("listing cards and homepage do not expose agent email", () => {
    const listingCard = readSource("src/components/ListingCard.jsx");
    const homePage = readSource("src/pages/index.js");
    expect(listingCard).not.toMatch(/mailto:/);
    expect(homePage).not.toMatch(/mailto:/);
  });
});
