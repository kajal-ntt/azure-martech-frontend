import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  output: "standalone",

  // Turbopack config (Next.js 15+ default bundler)
  turbopack: {},

  // Keep webpack config for non-Turbopack builds
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.alias = { ...config.resolve.alias, canvas: false };
    }
    return config;
  },


  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      // Required for SharedArrayBuffer (used by @ffmpeg/ffmpeg)
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
    ];

    if (process.env.NODE_ENV === "production") {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      });
    }

    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
