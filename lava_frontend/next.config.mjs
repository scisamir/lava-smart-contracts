import path from "path";

const supportedLavaNetworks = ["preprod", "mainnet"];
const lavaNetwork = process.env.LAVA_NETWORK?.trim();

if (!lavaNetwork || !supportedLavaNetworks.includes(lavaNetwork)) {
  throw new Error(
    `LAVA_NETWORK must be one of: ${supportedLavaNetworks.join(", ")}`
  );
}

const DEFAULT_BACKEND_URL =
  "https://tk3y4kw3f6.execute-api.us-east-1.amazonaws.com/prod";

const rawBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
const backendUrl =
  !rawBackendUrl || rawBackendUrl.includes("0lth59w8rl")
    ? DEFAULT_BACKEND_URL
    : rawBackendUrl;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // "/" serves the marketing landing page straight out of public/ — it ships its
  // own WebGPU hero, importmap and ES modules, so it stays a static document
  // rather than being rebuilt as a React page. beforeFiles runs ahead of the
  // pages/ lookup, so no pages/index.tsx is needed (or wanted).
  async rewrites() {
    return {
      beforeFiles: [{ source: "/", destination: "/landing.html" }],
      afterFiles: [],
      fallback: [],
    };
  },
  env: {
    LAVA_NETWORK: lavaNetwork,
    NEXT_PUBLIC_BACKEND_URL: backendUrl.replace(/\/$/, ""),
  },
  webpack(config) {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@": path.resolve(process.cwd(), "src"),
    };
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      // optional, only if your module requires synchronous wasm
      // syncWebAssembly: true,
    };
    return config;
  },
};

export default nextConfig;
