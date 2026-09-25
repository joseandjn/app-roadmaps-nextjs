import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Builds a self-contained server in .next/standalone for the Docker image
  // (see Dockerfile and docs/docker.md).
  output: "standalone",
};

export default nextConfig;
