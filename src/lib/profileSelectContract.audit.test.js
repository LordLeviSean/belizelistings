const fs = require("fs");
const path = require("path");

const SRC_ROOT = path.join(__dirname, "..");
const CONTRACT_FILE = path.join(__dirname, "profileSelectContract.js");
const FORBIDDEN_COLUMNS = [
  "verification_status",
  "agent_verification_status",
  "verified_at",
  "full_name",
  "display_name",
  "brokerage_id",
];

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

function extractProfilesSelectLiterals(text) {
  const literals = [];
  const re = /\.from\(["']profiles["']\)[\s\S]{0,200}?\.select\(\s*(["'`])([\s\S]*?)\1/g;
  let m;
  while ((m = re.exec(text))) {
    literals.push(m[2]);
  }
  return literals;
}

describe("profileSelectContract repo audit", () => {
  it("profiles SELECT literals outside contract exclude forbidden columns and select(*)", () => {
    const files = walk(SRC_ROOT).filter((f) => path.normalize(f) !== path.normalize(CONTRACT_FILE));
    const violations = [];

    for (const file of files) {
      const text = fs.readFileSync(file, "utf8");
      if (!text.includes('from("profiles")') && !text.includes("from('profiles')")) {
        continue;
      }

      for (const literal of extractProfilesSelectLiterals(text)) {
        if (literal.trim() === "*") {
          violations.push(`${path.relative(SRC_ROOT, file)}: profiles select(*) is forbidden`);
        }
        for (const col of FORBIDDEN_COLUMNS) {
          if (literal.includes(col)) {
            violations.push(`${path.relative(SRC_ROOT, file)}: profiles select includes ${col}`);
          }
        }
        if (!/PROFILE_[A-Z0-9_]+/.test(literal) && !/^[a-z0-9_,\s]+$/i.test(literal.trim())) {
          violations.push(
            `${path.relative(SRC_ROOT, file)}: profiles select must use PROFILE_* constants or migration-safe literals`
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
