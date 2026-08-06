/** @jest-environment jsdom */

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import LearnMoreExperience from "./LearnMoreExperience";
import { PLATFORM_UPDATE_IDS } from "../../constants/platformUpdates";

const mockReplace = jest.fn();
const mockRouter = {
  asPath: "/learn-more",
  pathname: "/learn-more",
  query: {},
  replace: mockReplace,
};

jest.mock("next/router", () => ({
  useRouter: () => mockRouter,
}));

jest.mock("../../hooks/useUserRole", () => ({
  __esModule: true,
  default: () => ({ user: null, role: "user" }),
}));

jest.mock("../SiteNav", () => ({
  __esModule: true,
  default: () => <nav data-testid="site-nav" />,
}));

jest.mock("../BackButton", () => ({
  __esModule: true,
  default: ({ label }) => <button type="button">{label}</button>,
}));

function renderLearnMore() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<LearnMoreExperience />);
  });
  return { container, root };
}

describe("LearnMoreExperience", () => {
  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = "";
    window.location.hash = "";
    mockReplace.mockClear();
  });

  test("renders update archive entries", () => {
    renderLearnMore();
    expect(document.body.textContent).toMatch(/Release timeline/i);
    expect(document.body.textContent).toMatch(/Geographic Update/i);
    expect(document.body.textContent).toMatch(/Communication Update/i);
    expect(document.body.textContent).toMatch(/Performance Update/i);
    expect(document.body.textContent).toMatch(/Open Beta/i);
    expect(document.body.textContent).toMatch(/Built for Belize/i);
  });

  test("features geographic update by default", () => {
    renderLearnMore();
    expect(document.body.textContent).toMatch(/V1\.0 — Geographic Update/i);
    expect(document.body.textContent).toMatch(/LIVE · V1\.0/i);
  });

  test("switching archive entry updates detail panel", () => {
    renderLearnMore();
    const commTab = Array.from(document.querySelectorAll('[role="tab"]')).find((el) =>
      /Communication Update/i.test(el.textContent)
    );
    expect(commTab).toBeTruthy();
    act(() => {
      commTab.click();
    });
    expect(document.body.textContent).toMatch(/V1\.1 — Communication Update/i);
    expect(window.location.hash).toBe("#communication-update-v1");
  });

  test("hash deep-link opens geographic update entry", () => {
    window.location.hash = `#${PLATFORM_UPDATE_IDS.BUILT_FOR_BELIZE}`;
    mockRouter.asPath = `/learn-more#${PLATFORM_UPDATE_IDS.BUILT_FOR_BELIZE}`;
    renderLearnMore();
    expect(document.body.textContent).toMatch(/Built for Belize/i);
    expect(document.body.textContent).toMatch(/Explore\. Invest\. Thrive\./i);
  });

  test("archive tabs are keyboard-focusable buttons", () => {
    renderLearnMore();
    const tabs = document.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBeGreaterThanOrEqual(5);
    tabs.forEach((tab) => {
      expect(tab.tagName).toBe("BUTTON");
    });
  });

  test("renders mobile toolbar shell markup", () => {
    renderLearnMore();
    expect(document.querySelector('[class*="mobileToolbar"]')).toBeTruthy();
    expect(document.querySelector('[class*="introLeadMobile"]')).toBeTruthy();
  });
});
