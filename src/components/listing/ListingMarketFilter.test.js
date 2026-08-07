/** @jest-environment jsdom */

import fs from "fs";
import path from "path";
import React from "react";
import { renderToString } from "react-dom/server";
import ListingMarketFilter from "./ListingMarketFilter";
import styles from "./ListingMarketFilter.module.css";

describe("ListingMarketFilter", () => {
  test("renders canonical pill track and tabs", () => {
    const html = renderToString(
      <ListingMarketFilter value="for-sale" onChange={() => {}} ariaLabel="Market filter" />
    );
    expect(html).toContain('role="tablist"');
    expect(html).toContain("For Sale");
    expect(html).toContain("For Rent");
    expect(html).toContain(styles.track);
    expect(html).toContain(styles.buttonActive);
  });

  test("uses fully rounded pill tokens", () => {
    const css = fs.readFileSync(path.join(__dirname, "ListingMarketFilter.module.css"), "utf8");
    expect(css).toMatch(/border-radius:\s*999px/);
  });
});
