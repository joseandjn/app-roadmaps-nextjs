import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Builds a self-contained server in .next/standalone for the Docker image
  // (see Dockerfile and docs/docker.md).
  output: "standalone",
  // The app doesn't use next/image. Turning optimization off removes the
  // /_next/image endpoint, and with it the image-processing attack surface
  // (sharp/libvips) the server would otherwise expose.
  images: { unoptimized: true },
};

export default nextConfig;
