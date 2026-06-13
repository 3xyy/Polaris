import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // A stray package-lock.json in the home dir confuses workspace-root inference;
  // pin the root to this project so env files and module resolution stay local.
  turbopack: {
    root: path.resolve(),
  },
};

export default nextConfig;
