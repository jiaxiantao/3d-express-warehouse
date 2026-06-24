import type { NextConfig } from "next";

const isGithubPages = process.env.GITHUB_PAGES === "true";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: isGithubPages ? "export" : "standalone",
  basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  trailingSlash: isGithubPages,
  reactStrictMode: false,
  ...(isGithubPages
    ? {}
    : {
        async headers() {
          return [
            {
              source: "/models/:path*",
              headers: [
                {
                  key: "Cache-Control",
                  value: "public, max-age=31536000, immutable",
                },
              ],
            },
          ];
        },
      }),
};

export default nextConfig;
