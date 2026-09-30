import type { NextConfig } from "next";


import * as path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  turbopack: {
    root: path.resolve(__dirname, "..", ".."),
  },
  typescript: {
    ignoreBuildErrors: true
  }
};

const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";

if (isIpfs) {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
  nextConfig.images = {
    unoptimized: true,
  };
}



module.exports = nextConfig;