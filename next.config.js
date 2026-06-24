/** @type {import('next').NextConfig} */

function supabaseStorageRemotePatterns() {
  const patterns = [
    {
      protocol: "https",
      hostname: "yxepbzezoroaeagzzzui.supabase.co",
      pathname: "/storage/v1/object/public/**",
    },
    {
      protocol: "https",
      hostname: "yyepbzezoroaeagzzzui.supabase.co",
      pathname: "/storage/v1/object/public/**",
    },
    {
      protocol: "https",
      hostname: "xyepbzezoroaeagzzzui.supabase.co",
      pathname: "/storage/v1/object/public/**",
    },
  ];
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (envUrl) {
    try {
      const { hostname } = new URL(envUrl);
      if (hostname && !patterns.some((p) => p.hostname === hostname)) {
        patterns.push({
          protocol: "https",
          hostname,
          pathname: "/storage/v1/object/public/**",
        });
      }
    } catch {
      /* ignore malformed env URL */
    }
  }
  return patterns;
}

const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/agent/:username",
        destination: "/agents/:username",
        permanent: true,
      },
    ];
  },
  // Multi-MB listing uploads exceed the default 7s optimizer fetch+resize window.
  experimental: {
    imgOptTimeoutInSeconds: 45,
    imgOptConcurrency: 2,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // Keep in sync with `src/constants/imageQuality.js` — only listed values are valid on `<Image quality={…}>`.
    qualities: [75, 82],
    // Card thumbs (400px cap) + dashboard/admin row sizes; avoids overshooting default 384px bucket.
    imageSizes: [16, 32, 48, 64, 96, 112, 128, 256, 384, 400],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    minimumCacheTTL: 86400,
    remotePatterns: supabaseStorageRemotePatterns(),
  },
};

module.exports = nextConfig;
