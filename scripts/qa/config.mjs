/** Shared QA configuration — production smoke + local dev. */
export const QA_BASE_URL =
  process.env.QA_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://belizelistings.bz";

export const MOBILE_VIEWPORTS = [
  { name: "iphone-12", width: 390, height: 844 },
  { name: "iphone-14-pro", width: 393, height: 852 },
  { name: "iphone-xr", width: 414, height: 896 },
  { name: "iphone-14-pro-max", width: 430, height: 932 },
];

export const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

export const SCREENSHOT_ROOT = "qa-screenshots/regression";

export const QA_EMAIL = process.env.QA_EMAIL || "";
export const QA_PASSWORD = process.env.QA_PASSWORD || "";

export const SEA_FLOW_LEVELS = [0, 25, 50, 75, 100];

export function hasSignedInCredentials() {
  return Boolean(QA_EMAIL && QA_PASSWORD);
}

export function timestampDir() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
