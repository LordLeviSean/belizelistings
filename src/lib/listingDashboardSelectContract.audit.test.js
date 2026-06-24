const fs = require("fs");
const path = require("path");

const SRC_ROOT = path.join(__dirname, "..");
const CONTRACT_FILE = path.join(__dirname, "listingDashboardSelectContract.js");
const QUERIES_FILE = path.join(__dirname, "listingQueries.js");
const ALLOWED_FILES = new Set([
  path.normalize(CONTRACT_FILE),
  path.normalize(QUERIES_FILE),
  path.normalize(path.join(__dirname, "listingPersistence.js")),
  path.normalize(path.join(__dirname, "listingOperationalStats.js")),
  path.normalize(path.join(__dirname, "..", "utils", "ownershipAttribution.js")),
  path.normalize(path.join(__dirname, "..", "pages", "dashboard", "create.jsx")),
  path.normalize(path.join(__dirname, "..", "pages", "dashboard", "operator", "property", "[id].jsx")),
  path.normalize(path.join(__dirname, "..", "components", "AllListingsPanel.jsx")),
  path.normalize(path.join(__dirname, "..", "components", "PendingListingsPanel.jsx")),
  path.normalize(path.join(__dirname, "..", "components", "OperatorListingsPanel.jsx")),
  path.normalize(path.join(__dirname, "..", "components", "ManageUsersPanel.jsx")),
  path.normalize(path.join(__dirname, "..", "pages", "admin", "index.jsx")),
  path.normalize(path.join(__dirname, "..", "components", "notifications", "NotificationCenter.jsx")),
]);

const DASHBOARD_SCOPED = [
  path.join(SRC_ROOT, "pages", "dashboard"),
  path.join(SRC_ROOT, "components", "user"),
  path.join(SRC_ROOT, "stores", "useUserDashboardStore.js"),
];

const FORBIDDEN = ["occupied_at", "vacancy_status", "verification_status", "select(*)"];

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(full, acc);
      continue;
    }
    if (/\.(js|jsx)$/.test(name) && !/\.test\.(js|jsx)$/.test(name)) acc.push(full);
  }
  return acc;
}

function isDashboardScoped(file) {
  const norm = path.normalize(file);
  if (DASHBOARD_SCOPED.some((root) => norm.startsWith(path.normalize(root)))) return true;
  return norm.endsWith(path.normalize("stores/useUserDashboardStore.js"));
}

function extractListingsSelectLiterals(text) {
  const literals = [];
  const re = /\.from\(["']listings["']\)[\s\S]{0,240}?\.select\(\s*(["'`])([\s\S]*?)\1/g;
  let m;
  while ((m = re.exec(text))) {
    literals.push(m[2]);
  }
  return literals;
}

describe("listingDashboardSelectContract repo audit", () => {
  test("dashboard-scoped listings SELECT literals use contract-safe shapes", () => {
    const files = walk(SRC_ROOT).filter(isDashboardScoped);
    const violations = [];

    for (const file of files) {
      const norm = path.normalize(file);
      if (ALLOWED_FILES.has(norm)) continue;
      const text = fs.readFileSync(file, "utf8");
      if (!text.includes('from("listings")') && !text.includes("from('listings')")) continue;

      for (const literal of extractListingsSelectLiterals(text)) {
        const trimmed = literal.trim();
        if (trimmed === "*") {
          violations.push(`${path.relative(SRC_ROOT, file)}: listings select(*) forbidden`);
        }
        if (trimmed.includes("*, listing_images")) {
          violations.push(`${path.relative(SRC_ROOT, file)}: use listingDashboardSelectContract embed`);
        }
        for (const bad of FORBIDDEN) {
          if (bad === "select(*)" && trimmed === "*") continue;
          if (literal.includes(bad.replace("select(*)", "*"))) {
            violations.push(`${path.relative(SRC_ROOT, file)}: forbidden ${bad}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
