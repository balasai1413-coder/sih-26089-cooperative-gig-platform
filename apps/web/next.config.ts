import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Keep auth traffic same-origin in the browser. This lets the backend's
  // httpOnly refresh cookie work in local development without widening CORS.
  async rewrites() {
    const apiOrigin = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
