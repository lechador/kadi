import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // The Anchor workspace at the repo root has its own lockfile, so Next infers
  // the wrong project root and warns about it. The app is the deployable.
  turbopack: { root: __dirname },

  outputFileTracingIncludes: {
    // The share-card routes read the bundled Georgian font off disk at request
    // time. Nothing statically imports those files, so tracing cannot infer
    // them, and without this the deployed route renders empty boxes where the
    // Georgian should be.
    "/api/og/**": ["./assets/fonts/*.woff"],
  },
};

export default nextConfig;
