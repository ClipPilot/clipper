/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@clipper/shared-ui", "@clipper/shared-types"],
  turbopack: {},
};

module.exports = nextConfig;
