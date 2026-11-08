import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Photo drops go through a server action; the 1 MB default is too small for phone photos.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
