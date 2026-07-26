/** @type {import('next').NextConfig} */
const nextConfig = {
  // React strict mode helps catch bugs early
  reactStrictMode: true,

  // Image configuration for external images
  images: {
    unoptimized: false,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },

  // Server-side packages that need to be bundled
  serverExternalPackages: ["pg", "bcryptjs"],

  // Webpack configuration for handling specific modules
  webpack: (config, { isServer }) => {
    // Handle leaflet CSS imports
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        "pg-native": false,
      };
    }
    return config;
  },

  // Allow CORS for API routes during development
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },
};

export default nextConfig;
