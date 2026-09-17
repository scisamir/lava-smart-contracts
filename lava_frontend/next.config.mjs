import path from "path";

const supportedLavaNetworks = ["preprod", "mainnet"];
const lavaNetwork = process.env.LAVA_NETWORK?.trim();

if (!lavaNetwork || !supportedLavaNetworks.includes(lavaNetwork)) {
  throw new Error(
    `LAVA_NETWORK must be one of: ${supportedLavaNetworks.join(", ")}`
  );
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();

if (process.env.NODE_ENV === "production" && !backendUrl) {
  throw new Error(
    "NEXT_PUBLIC_BACKEND_URL is required for production frontend builds"
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    LAVA_NETWORK: lavaNetwork,
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
