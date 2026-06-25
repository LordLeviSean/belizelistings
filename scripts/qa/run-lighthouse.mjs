#!/usr/bin/env node
/**
 * Lighthouse summary — runs when lighthouse + chrome-launcher are available; otherwise skips with message.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { QA_BASE_URL, timestampDir } from "./config.mjs";

const outDir = join("qa-screenshots", "qa-runs", timestampDir());
mkdirSync(outDir, { recursive: true });

let lighthouse;
let chromeLauncher;
try {
  lighthouse = (await import("lighthouse")).default;
  chromeLauncher = await import("chrome-launcher");
} catch {
  console.log(
    JSON.stringify({
      pass: true,
      skipped: true,
      message:
        "Lighthouse not installed — run: npm i -D lighthouse chrome-launcher. Mobile/desktop smoke a11y still runs in qa:mobile.",
    })
  );
  process.exit(0);
}

const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless"] });
try {
  const options = {
    logLevel: "error",
    output: "json",
    onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    port: chrome.port,
    formFactor: "mobile",
    screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2, disabled: false },
  };
  const runner = await lighthouse(QA_BASE_URL, options);
  const report = runner.lhr;
  const summary = {
    suite: "qa:lighthouse",
    url: QA_BASE_URL,
    scores: {
      performance: report.categories.performance?.score,
      accessibility: report.categories.accessibility?.score,
      bestPractices: report.categories["best-practices"]?.score,
      seo: report.categories.seo?.score,
    },
  };
  const path = join(outDir, "lighthouse-summary.json");
  writeFileSync(path, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ pass: true, summary, path }, null, 2));
} finally {
  await chrome.kill();
}
