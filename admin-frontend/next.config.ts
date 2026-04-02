import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@clipper/shared-ui", "@clipper/shared-types"],
  turbopack: {},
};

export default nextConfig;
